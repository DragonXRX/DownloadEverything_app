const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const YTDLP_PATH = path.join(__dirname, 'yt-dlp.exe');

// Standard extractor arguments that simulate mobile YouTube clients (bypassing bot blocks / sign-in requirements)
const CLIENT_ARGS = [
  '--extractor-args',
  'youtube:player_client=ios,android,web'
];

// Helper to format duration
function formatDuration(seconds) {
  const sec = parseInt(seconds, 10);
  if (isNaN(sec)) return '0:00';
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const remainingSecs = sec % 60;
  if (hrs > 0) {
    return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
  }
  return `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
}

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'DownloadEverything Backend is active and running.',
    engine: 'yt-dlp'
  });
});

// 2. Fetch video details & resolutions
app.post('/api/info', (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string' || !url.trim().startsWith('http')) {
    return res.status(400).json({ error: 'المرجو إدخال رابط يوتيوب صحيح.' });
  }

  const cleanUrl = url.trim();

  // Run yt-dlp to get JSON metadata using mobile client spoofing
  const ytdlp = spawn(YTDLP_PATH, [
    '--dump-json',
    '--no-warnings',
    '--no-playlist',
    ...CLIENT_ARGS,
    cleanUrl
  ]);

  let stdoutData = '';
  let stderrData = '';

  ytdlp.stdout.on('data', (chunk) => {
    stdoutData += chunk;
  });

  ytdlp.stderr.on('data', (chunk) => {
    stderrData += chunk;
  });

  ytdlp.on('close', (code) => {
    if (code !== 0 || !stdoutData) {
      console.error('yt-dlp info error:', stderrData);
      return res.status(500).json({
        error: 'تعذر جلب تفاصيل الفيديو. تأكد من أن الرابط صحيح.',
        details: stderrData
      });
    }

    try {
      const json = JSON.parse(stdoutData);

      // Extract resolutions
      const formats = json.formats || [];
      const qualityMap = new Map();

      // Find formats
      formats.forEach((f) => {
        if (f.height) {
          const label = `${f.height}p`;
          if (!qualityMap.has(label)) {
            qualityMap.set(label, {
              format_id: f.format_id,
              quality: label,
              ext: 'mp4',
              height: f.height,
              filesize: f.filesize || f.filesize_approx || null,
              hasVideo: true,
              type: 'video'
            });
          }
        }
      });

      const videoOptions = Array.from(qualityMap.values()).sort((a, b) => b.height - a.height);

      // Standard common qualities fallback
      if (videoOptions.length === 0) {
        ['720p', '480p', '360p'].forEach((q) => {
          videoOptions.push({
            format_id: `bestvideo[height<=${q.replace('p', '')}]+bestaudio/best`,
            quality: q,
            ext: 'mp4',
            height: parseInt(q, 10),
            hasVideo: true,
            type: 'video'
          });
        });
      }

      const audioOption = {
        format_id: 'bestaudio/best',
        quality: 'عالي الجودة (صوت فقط)',
        ext: 'mp3',
        hasAudio: true,
        hasVideo: false,
        type: 'audio'
      };

      // Best thumbnail
      const thumbnails = json.thumbnails || [];
      const bestThumbnail = json.thumbnail || (thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : '');

      return res.json({
        success: true,
        data: {
          id: json.id,
          title: json.title,
          author: json.uploader || json.channel || 'YouTube Creator',
          duration: formatDuration(json.duration),
          durationSeconds: json.duration,
          views: json.view_count || 0,
          likes: json.like_count || 0,
          thumbnail: bestThumbnail,
          videoOptions,
          audioOption
        }
      });
    } catch (parseErr) {
      console.error('Failed to parse yt-dlp JSON:', parseErr.message);
      return res.status(500).json({ error: 'حدث خطأ أثناء معالجة بيانات الفيديو.' });
    }
  });
});

// 3. Stream direct download
app.get('/api/download', (req, res) => {
  const { url, quality, type, title } = req.query;

  if (!url) {
    return res.status(400).send('رابط الفيديو مطلوب.');
  }

  const safeTitle = (title ? String(title) : 'DownloadEverything_Video')
    .replace(/[^\w\s\u0600-\u06FF-]/gi, '')
    .trim() || 'video';

  if (type === 'audio') {
    // Download best audio
    res.header('Content-Disposition', `attachment; filename="${encodeURIComponent(safeTitle)}.mp3"`);
    res.header('Content-Type', 'audio/mpeg');

    const downloadProcess = spawn(YTDLP_PATH, [
      '-f', 'bestaudio/best',
      '-o', '-',
      '--no-playlist',
      ...CLIENT_ARGS,
      url
    ]);

    downloadProcess.stdout.pipe(res);

    downloadProcess.stderr.on('data', () => {});

    req.on('close', () => {
      downloadProcess.kill('SIGTERM');
    });
  } else {
    // Video download
    const formatArg = quality
      ? `bestvideo[height<=${quality.replace('p', '')}]+bestaudio/best[height<=${quality.replace('p', '')}]/best`
      : 'best';

    res.header('Content-Disposition', `attachment; filename="${encodeURIComponent(safeTitle)}.mp4"`);
    res.header('Content-Type', 'video/mp4');

    const downloadProcess = spawn(YTDLP_PATH, [
      '-f', formatArg,
      '-o', '-',
      '--no-playlist',
      ...CLIENT_ARGS,
      url
    ]);

    downloadProcess.stdout.pipe(res);

    req.on('close', () => {
      downloadProcess.kill('SIGTERM');
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 DownloadEverything Backend ready on port ${PORT}`);
});
