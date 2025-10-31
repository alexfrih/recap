# 🚀 Deployment Guide - Video Recap App

## Quick Deploy to Render.com (5 minutes)

### Prerequisites
- GitHub account
- Render.com account (free) - [Sign up here](https://render.com)
- OpenAI API key - [Get it here](https://platform.openai.com/api-keys)
- (Optional) ElevenLabs API key for text-to-speech - [Get it here](https://elevenlabs.io)

---

## Step-by-Step Deployment

### 1. Push to GitHub (if not already done)

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### 2. Connect to Render.com

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Render will auto-detect the `render.yaml` file

### 3. Configure Environment Variables

In the Render dashboard, add these environment variables:

**Required:**
- `OPENAI_API_KEY` - Your OpenAI API key
- `NODE_ENV` - Set to `production` (auto-set by render.yaml)

**Optional:**
- `ELEVENLABS_API_KEY` - Only needed if you want text-to-speech features

### 4. Deploy!

Click **"Create Web Service"** and Render will:
- ✅ Build the Docker image with FFmpeg
- ✅ Install dependencies
- ✅ Build Next.js app
- ✅ Deploy with SSL certificate
- ✅ Give you a URL like `https://your-app.onrender.com`

**First deployment takes ~5-10 minutes**

---

## Free Tier vs Paid Plan

### Free Tier ($0/month)
- ✅ 750 hours/month (plenty for testing)
- ⚠️ **Spins down after 15 min inactivity**
- ⚠️ Cold start: 30-60 seconds when waking up
- ✅ 100GB bandwidth
- ✅ Automatic SSL

**Good for:** Testing, demos, personal use

### Starter Plan ($7/month)
- ✅ **Always on** - no spin-down
- ✅ Instant response times
- ✅ 100GB bandwidth
- ✅ Everything from free tier

**Good for:** Production, real users

To upgrade: Dashboard → Service Settings → Instance Type → "Starter"

---

## Testing Your Deployment

Once deployed:

1. Visit your Render URL
2. Try uploading a short MP4 video (or use a YouTube URL)
3. Watch the step-by-step progress
4. Check that transcription and summary work

**Note:** First request on free tier may take 30-60s if service is spun down.

---

## Troubleshooting

### Build fails with "FFmpeg not found"
- ✅ Already fixed - Dockerfile installs FFmpeg automatically

### "Out of memory" during build
- Increase build instance size in Render settings (may require paid plan)

### API errors
- Check environment variables are set correctly
- Verify OpenAI API key is valid and has credits

### Videos fail to process
- Check Render logs: Dashboard → Your Service → Logs
- Verify FFmpeg is installed: Add test endpoint or check build logs

### Timeout errors
- Free tier has 60s timeout for HTTP requests
- Paid plans have 300s timeout
- For very long videos, consider upgrading

---

## Cost Optimization Tips

### Stay on Free Tier
- Accept 15min spin-down
- Use for testing/personal projects
- Monitor monthly hours (750 max)

### Minimize Costs on Paid Plan
- Start with Starter ($7/mo)
- Monitor bandwidth usage
- Use efficient video compression settings

---

## Alternative Deployment Options

If Render doesn't work for you:

### Railway.app (~$5-10/month)
1. Connect GitHub repo
2. Add environment variables
3. Deploy (auto-detects Dockerfile)

### Fly.io (Pay-as-you-go)
```bash
flyctl launch
flyctl secrets set OPENAI_API_KEY=your_key
flyctl deploy
```

### Self-Hosted VPS (Hetzner €4.51/month)
```bash
# SSH into VPS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs ffmpeg nginx certbot
git clone your-repo.git
cd your-repo
npm install
npm run build
npm install -g pm2
pm2 start npm --name "recap" -- start
pm2 startup
pm2 save
# Setup nginx reverse proxy + SSL
```

---

## Monitoring & Maintenance

### Check Application Health
- Render Dashboard → Logs
- Monitor error rates
- Watch memory/CPU usage

### Updates
- Push to GitHub main branch → Auto-deploys on Render
- Monitor build logs for errors

### Scaling
- Upgrade instance type if needed
- Add auto-scaling rules (paid plans only)

---

## Support

- **Render Docs:** https://render.com/docs
- **Render Community:** https://community.render.com
- **This App Issues:** Open GitHub issue in your repository

---

## Security Notes

⚠️ **Never commit `.env` files or API keys to Git**

✅ Always use Render's environment variables dashboard

✅ Rotate API keys regularly

✅ Monitor API usage to prevent unexpected charges

---

## Summary

**Quickest path to production:**
1. Push code to GitHub → 1 min
2. Connect to Render → 1 min  
3. Add API keys → 1 min
4. Deploy → 5-10 min

**Total time: ~15 minutes from zero to live app**

🎉 **Your app is now live and ready to process videos!**
