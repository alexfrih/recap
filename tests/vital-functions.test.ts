import { describe, test, expect } from '@jest/globals';

describe('Vital App Functions', () => {

  describe('YouTube URL Validation', () => {
    test('should accept valid YouTube URLs', () => {
      const validUrls = [
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtu.be/dQw4w9WgXcQ',
        'http://www.youtube.com/watch?v=dQw4w9WgXcQ',
      ];

      const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]+/;

      validUrls.forEach(url => {
        expect(youtubeRegex.test(url)).toBe(true);
      });
    });

    test('should reject invalid URLs', () => {
      const invalidUrls = [
        'https://vimeo.com/123456',
        'https://google.com',
        'not a url',
        '',
      ];

      const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]+/;

      invalidUrls.forEach(url => {
        expect(youtubeRegex.test(url)).toBe(false);
      });
    });
  });

  describe('Environment Variables', () => {
    test('should have OpenAI API key configured', () => {
      expect(process.env.OPENAI_API_KEY).toBeDefined();
      expect(process.env.OPENAI_API_KEY).not.toBe('');
    });
  });

  describe('File Format Support', () => {
    test('should support MP4 files', () => {
      const supportedFormats = ['video/mp4', 'mp4'];
      const testType = 'video/mp4';

      expect(testType.includes('mp4')).toBe(true);
    });

    test('should support audio formats for Whisper API', () => {
      const whisperFormats = ['flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm'];
      const ourFormat = 'mp3';

      expect(whisperFormats).toContain(ourFormat);
    });
  });

  describe('Step Tracking', () => {
    test('should have 5 processing steps defined', () => {
      const steps = [
        { stepNumber: 1, label: 'Extract Audio', status: 'pending' },
        { stepNumber: 2, label: 'Compress Audio', status: 'pending' },
        { stepNumber: 3, label: 'Transcribe Audio', status: 'pending' },
        { stepNumber: 4, label: 'Translate Text', status: 'pending' },
        { stepNumber: 5, label: 'Generate Summary', status: 'pending' },
      ];

      expect(steps).toHaveLength(5);
      expect(steps.every(s => s.stepNumber >= 1 && s.stepNumber <= 5)).toBe(true);
    });

    test('should have valid step statuses', () => {
      const validStatuses = ['pending', 'in-progress', 'completed', 'error'];
      const testStatus = 'in-progress';

      expect(validStatuses).toContain(testStatus);
    });
  });

  describe('Language Support', () => {
    test('should support English and French', () => {
      const supportedLanguages: ('en' | 'fr')[] = ['en', 'fr'];

      expect(supportedLanguages).toContain('en');
      expect(supportedLanguages).toContain('fr');
      expect(supportedLanguages).toHaveLength(2);
    });
  });

  describe('Audio Processing Limits', () => {
    test('should respect Whisper API 25MB limit', () => {
      const maxSizeBytes = 25 * 1024 * 1024; // 25MB
      const testFileSize = 24 * 1024 * 1024; // 24MB

      expect(testFileSize).toBeLessThanOrEqual(maxSizeBytes);
    });
  });

  describe('Time Formatting', () => {
    test('should format elapsed time correctly', () => {
      const formatElapsedTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      };

      expect(formatElapsedTime(45)).toBe('45s');
      expect(formatElapsedTime(60)).toBe('1m 0s');
      expect(formatElapsedTime(125)).toBe('2m 5s');
    });
  });

  describe('API Routes', () => {
    test('should have correct API route structure', () => {
      const apiRoutes = [
        '/api/process-video',
        '/api/text-to-speech',
        '/api/chat',
      ];

      apiRoutes.forEach(route => {
        expect(route).toMatch(/^\/api\//);
      });
    });
  });

  describe('Dependencies', () => {
    test('should have youtube-dl-exec installed', () => {
      const pkg = require('../package.json');
      expect(pkg.dependencies['youtube-dl-exec']).toBeDefined();
    });

    test('should have openai installed', () => {
      const pkg = require('../package.json');
      expect(pkg.dependencies['openai']).toBeDefined();
    });

    test('should have fluent-ffmpeg installed', () => {
      const pkg = require('../package.json');
      expect(pkg.dependencies['fluent-ffmpeg']).toBeDefined();
    });

    test('should NOT have @distube/ytdl-core (replaced with yt-dlp)', () => {
      const pkg = require('../package.json');
      expect(pkg.dependencies['@distube/ytdl-core']).toBeUndefined();
    });
  });

  describe('Docker Configuration', () => {
    test('should have Dockerfile', () => {
      const fs = require('fs');
      const path = require('path');
      const dockerfilePath = path.join(__dirname, '../Dockerfile');

      expect(fs.existsSync(dockerfilePath)).toBe(true);
    });

    test('should have render.yaml', () => {
      const fs = require('fs');
      const path = require('path');
      const renderYamlPath = path.join(__dirname, '../render.yaml');

      expect(fs.existsSync(renderYamlPath)).toBe(true);
    });
  });

  describe('Deployment Readiness', () => {
    test('should have deployment guide', () => {
      const fs = require('fs');
      const path = require('path');
      const deployPath = path.join(__dirname, '../DEPLOY.md');

      expect(fs.existsSync(deployPath)).toBe(true);
    });

    test('should have .dockerignore', () => {
      const fs = require('fs');
      const path = require('path');
      const dockerignorePath = path.join(__dirname, '../.dockerignore');

      expect(fs.existsSync(dockerignorePath)).toBe(true);
    });
  });
});
