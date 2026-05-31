# ChitrChatr - Premium Real-Time Messenger 💬

ChitrChatr is a modern, responsive, and secure real-time mobile chat application built for an internship assessment project. The project is constructed using **React (Vite)** on the frontend, **Supabase** (Auth, Database, and Realtime WebSocket replication) on the backend, and **Capacitor** for seamless integration and Android APK generation.

---

## 🚀 Key Features

*   **Secure Authentication**: Fully integrated email/password registration and login with session persistence.
*   **Active Directory Sync**: Automated client-side profiles cataloging to connect users immediately.
*   **Direct Messaging (1-on-1)**: Clean modal interface allowing quick searches by email and suggested user directories to initiate conversation threads.
*   **WhatsApp-like UI**: Mobile-first scrollable interface with user-oriented bubble orientations and automatic view centering.
*   **Supabase Realtime Synchronization**: Multi-instance instant messaging using robust WebSocket listeners.
*   **Capacitor Native Readiness**: Pre-packaged Android native wrapper configurations.

---

## 🛠️ Tech Stack

*   **Frontend**: React.js, React Router DOM, Vanilla CSS (Premium curated HSL design system), Lucide React (Icons).
*   **Backend**: Supabase Auth, Supabase DB (PostgreSQL), Supabase Realtime (WebSockets).
*   **Mobile Framework**: Capacitor (@capacitor/core, @capacitor/cli, @capacitor/android).

---

## ⚙️ Supabase Database Configuration

To set up the backend, create a new project in your **Supabase Dashboard** and execute the following SQL script inside the **SQL Editor**:

```sql
-- 1. Create Tables
-- Create Profiles Table (extends Supabase Auth users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Conversations Table
CREATE TABLE public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Conversation Participants Table
CREATE TABLE public.conversation_participants (
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    PRIMARY KEY (conversation_id, user_id)
);

-- Create Messages Table
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
-- Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert/update their own profile" ON public.profiles FOR ALL USING (auth.uid() = id);

-- Conversations Policies
CREATE POLICY "Users can view conversations they are part of" 
ON public.conversations FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.conversation_participants 
        WHERE conversation_participants.conversation_id = conversations.id 
        AND conversation_participants.user_id = auth.uid()
    )
);
CREATE POLICY "Users can create conversations" ON public.conversations FOR INSERT WITH CHECK (true);

-- Conversation Participants Policies
CREATE POLICY "Users can view participants for their conversations" 
ON public.conversation_participants FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.conversation_participants cp
        WHERE cp.conversation_id = conversation_participants.conversation_id 
        AND cp.user_id = auth.uid()
    )
);
CREATE POLICY "Users can add participants" ON public.conversation_participants FOR INSERT WITH CHECK (true);

-- Messages Policies
CREATE POLICY "Users can view messages in their conversations" 
ON public.messages FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.conversation_participants 
        WHERE conversation_participants.conversation_id = messages.conversation_id 
        AND conversation_participants.user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert messages in their conversations" 
ON public.messages FOR INSERT 
WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
        SELECT 1 FROM public.conversation_participants 
        WHERE conversation_participants.conversation_id = messages.conversation_id 
        AND conversation_participants.user_id = auth.uid()
    )
);
```

### ⚠️ IMPORTANT: Enable Supabase Realtime
To make sure messages stream instantly across active windows without refreshing, you **MUST** enable PostgreSQL replication for the `messages` table:
1. Navigate to your **Supabase Dashboard**.
2. Go to **Database** -> **Replication**.
3. Under **Source**, edit the `supabase_realtime` publication.
4. Toggle and enable the replication rule for the **`messages`** table.

---

## 📂 Project Structure

The project directory is structured cleanly and modularly:

```text
src/
  ├── components/
  │   └── ProtectedRoute.jsx   # Custom security middleware component
  ├── pages/
  │   ├── Login.jsx            # Sleek login / signup gate
  │   ├── ChatList.jsx         # Conversation dashboard and contact finder
  │   └── Chat.jsx             # Active messenger feed and realtime sync
  ├── lib/
  │   └── supabase.js          # Supabase client core configurations
  ├── index.css                # Premium modern HSL light/dark styling
  ├── App.jsx                  # Main routing control
  └── main.jsx                 # Scaffolding entrypoint
```

---

## 💻 Local Setup & Development

### 1. Clone the project and install packages:
```bash
# Navigate to the workspace
cd arham_shares

# Install dependencies
npm install
```

### 2. Configure Environment Variables
Create a file named `.env` in the root of the project directory and paste your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-supabase-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anonymous-public-key
```

### 3. Launch Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser to start chatting!

---

## 📱 Android APK Generation (Capacitor)

Capacitor wraps the web application build and generates native Android source directories. Follow these steps to bundle the application and compile the APK:

### 1. Compile Web Assets
Build the production-ready static assets (output folder: `/dist`):
```bash
npm run build
```

### 2. Synchronize Assets with Native Platforms
Copy the built assets into the native Android folder:
```bash
npx cap sync
```

### 3. Open Project in Android Studio
Open the project's native code in Android Studio to build/compile your APK file:
```bash
npx cap open android
```

### 4. Build APK from Android Studio
*   In Android Studio, let Gradle sync complete.
*   Navigate to **Build** -> **Build Bundle(s) / APK(s)** -> **Build APK(s)**.
*   Once finished, a popup will display in the bottom right corner showing the location of the compiled `app-debug.apk` file!
