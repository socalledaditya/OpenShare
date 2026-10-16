# 🚀 openShare

**openShare** is a fast, temporary, ephemeral file sharing platform designed for seamless cross-device transfers without permanent server clutter. Share documents, media, and archives instantly using unique room codes, QR codes, or direct share links.

---

## 🌟 Key Features

- ⚡ **Instant Disposable Transfer**: Create temporary rooms that auto-delete after a configured duration (15 min, 1 hour, 6 hours) or can be wiped permanently with one click.
- 📱 **QR Code & Room Code Sharing**: Receivers join instantly by scanning a QR code or entering a short 4-character room code (e.g., `BEAM-4829`).
- 🔐 **Optional Password Protection**: Secure rooms with a custom passcode so only intended receivers can access uploaded files.
- 📄 **Universal Multi-Format Support**: Dedicated preview & icon categorizations for all document formats (**PDF, DOCX, PPTX, XLSX, TXT, CSV, RTF**), videos, audio, images, archives (**ZIP, RAR, 7Z**), and code files up to 500MB.
- 📦 **Batch ZIP Download**: Receivers can download all files in a room simultaneously in a single compressed ZIP bundle.
- 👤 **Guest & Multi-Room Account Modes**:
  - **Guest Mode**: No sign-in required. Create 1 active room instantly.
  - **Registered Account Mode**: Sign up to create and manage **multiple rooms simultaneously** from a centralized "My Rooms" dashboard.
- 🗄️ **MongoDB Persistence**: User registrations, accounts, and active room records are stored securely in MongoDB.

---

## 💡 Real-World Use Cases

### 1. 📱 Fast Cross-Device Personal Transfer
- **Scenario**: You have a video, PDF ticket, or document on your phone and need it on your laptop (or vice versa).
- **Why openShare**: Instead of emailing yourself, sending via WhatsApp, or waiting for cloud storage sync, generate a 4-character room code on your phone, open `openShare` on your laptop, enter the code, and download the file immediately.

### 2. 💼 Freelancer & Agency Client Asset Delivery
- **Scenario**: Delivering design proofs, video edits, contract drafts, or invoices to a client.
- **Why openShare**: Protect the transfer with an optional passcode and set a 1-hour auto-delete timer. Your files are automatically purged from the server once delivered, leaving zero digital clutter.

### 3. 🎓 Classroom, Workshops & Event Presentations
- **Scenario**: A speaker or instructor wants to distribute slides, PDF worksheets, or code files to an audience of 50+ attendees.
- **Why openShare**: Display the room's **QR Code** on a projector. Attendees scan the QR code with their mobile devices to immediately access and download the files without signing up.

### 4. 🔒 Confidential Document Exchange
- **Scenario**: Sharing sensitive financial reports, legal documents, or credentials with a colleague.
- **Why openShare**: Set a custom password on the room. Once the recipient downloads the files, click **"Close & Delete"** to instantly and permanently wipe all files and room records from the server storage.

### 5. 🎬 Large Media & Video File Distribution
- **Scenario**: Sharing large 4K video clips, audio stems, or compressed archives up to 500MB without hitting email attachment limits or consuming personal Google Drive/Dropbox storage quotas.
- **Why openShare**: Supports high-speed chunked transfers with progress indicators and batch ZIP downloads.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide React Icons
- **Backend**: Express.js, Node.js, WebSockets (`ws`), Multer (file upload handler), Archiver (ZIP bundler)
- **Authentication**: JWT (JSON Web Tokens), Bcryptjs password hashing
- **Database**: MongoDB (via Mongoose) with automatic in-memory fallback

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- npm / yarn / pnpm

### Installation

1. **Clone the repository and install dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in the root directory:
   ```env
   PORT=3000
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/openshare?retryWrites=true&w=majority
   JWT_SECRET=your_secure_jwt_secret_here
   ```

3. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:3000`.

---

## ☁️ Deployment on Vercel

openShare is pre-configured for one-click deployment on Vercel:

1. Import your GitHub repository into [Vercel](https://vercel.com/new).
2. Add `MONGODB_URI` and `JWT_SECRET` in **Project Settings > Environment Variables**.
3. Deploy! Vercel uses `vercel.json` to automatically serve static frontend assets and deploy the backend routes.

---

## 📄 License
Apache-2.0 License.
