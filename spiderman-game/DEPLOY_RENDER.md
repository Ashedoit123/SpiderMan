# 🚀 How to Deploy Spider-Man Web Shooter on Render

You can deploy this application on **[Render.com](https://render.com)** for free.

---

## ⚡ Method 1: Deploy as a Static Site (Recommended — 100% Free & Fast)

Render's **Static Site** tier is free, provides a global CDN, automatic SSL (`https://`), and has zero cold-start delay.

### Steps:
1. **Push your code to GitHub / GitLab**:
   ```bash
   git init
   git add .
   git commit -m "Spider-Man Web Shooter"
   git remote add origin https://github.com/your-username/spiderman-web-shooter.git
   git push -u origin main
   ```

2. **Go to Render**:
   - Log in at **[dashboard.render.com](https://dashboard.render.com)**
   - Click **"New +"** (top right) $\rightarrow$ **"Static Site"**

3. **Connect Repository**:
   - Select your `spiderman-web-shooter` repository.

4. **Configure Settings**:
   | Field | Value |
   |---|---|
   | **Name** | `spiderman-web-shooter` |
   | **Branch** | `main` |
   | **Build Command** | `npm install && npm run build` |
   | **Publish Directory** | `dist` |

5. **Click "Create Static Site"**:
   - Render will build your site and give you a live URL like:  
     `https://spiderman-web-shooter.onrender.com`

---

## 🌐 Method 2: Deploy as a Web Service (Node.js Server)

If you prefer running a Node.js web server (`server.js` included):

### Steps:
1. On **[dashboard.render.com](https://dashboard.render.com)**, click **"New +"** $\rightarrow$ **"Web Service"**.
2. Connect your GitHub repository.
3. Configure settings:
   | Field | Value |
   |---|---|
   | **Name** | `spiderman-web-shooter` |
   | **Runtime** | `Node` |
   | **Build Command** | `npm install && npm run build` |
   | **Start Command** | `npm start` |

4. Click **"Create Web Service"**.

---

## 📄 Method 3: 1-Click Render Blueprint (Using `render.yaml`)

We have included a `render.yaml` file in the project.
1. In Render Dashboard, click **"New +"** $\rightarrow$ **"Blueprint"**.
2. Select your repository.
3. Render will automatically read `render.yaml` and set up the build command (`npm install && npm run build`) and publish path (`./dist`) with zero manual configuration.
