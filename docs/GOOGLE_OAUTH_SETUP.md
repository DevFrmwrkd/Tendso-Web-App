# Google OAuth Setup Guide for Supabase

## Overview

This guide will walk you through setting up Google Sign-In for your Tendso authentication system.

## 🔧 Supabase Dashboard Setup

### Step 1: Get Google OAuth Credentials

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Sign in with your Google account

2. **Create a New Project** (if needed)
   - Click "Select a project" at the top
   - Click "New Project"
   - Name it: `Tendso` (or your preferred name)
   - Click "Create"

3. **Enable Google+ API**
   - Go to: **APIs & Services** → **Library**
   - Search for: **"Google+ API"**
   - Click on it and click **"Enable"**

4. **Configure OAuth Consent Screen**
   - Go to: **APIs & Services** → **OAuth consent screen**
   - Choose **User Type**: External
   - Click **"Create"**
   - Fill in required fields:
     - **App name**: Tendso
     - **User support email**: Your email
     - **Developer contact**: Your email
   - Click **"Save and Continue"**
   - Skip **Scopes** (click "Save and Continue")
   - Skip **Test users** (click "Save and Continue")
   - Click **"Back to Dashboard"**

5. **Create OAuth 2.0 Credentials**
   - Go to: **APIs & Services** → **Credentials**
   - Click **"+ Create Credentials"** → **"OAuth client ID"**
   - Choose **Application type**: Web application
   - **Name**: Tendso Web Client
   - **Authorized JavaScript origins**:
     - Add: `http://localhost:3000` (for local development)
     - Add: `https://yourdomain.com` (for production, if you have it)
   - **Authorized redirect URIs**: (LEAVE EMPTY FOR NOW - we'll add this from Supabase)
   - Click **"Create"**
   
6. **Copy Your Credentials**
   - You'll see a popup with:
     - **Client ID** (looks like: `123456789-abc123.apps.googleusercontent.com`)
     - **Client Secret** (looks like: `GOCSPX-abcdefg123456`)
   - **SAVE THESE!** You'll need them in the next step

---

### Step 2: Configure Supabase

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Select your **Tendso** project

2. **Navigate to Authentication Providers**
   ```
   Authentication → Providers → Google
   ```

3. **Enable Google Provider**
   - Toggle **"Enable Sign in with Google"** to ON

4. **Add Google Credentials**
   - **Client ID**: Paste the Client ID from Google Console
   - **Client Secret**: Paste the Client Secret from Google Console

5. **Copy the Callback URL**
   - Supabase will show you a **Callback URL (Redirect URL)**
   - It looks like: `https://your-project-ref.supabase.co/auth/v1/callback`
   - **Copy this URL!**

6. **Click "Save"**

---

### Step 3: Add Callback URL to Google Console

1. **Go Back to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Go to: **APIs & Services** → **Credentials**

2. **Edit Your OAuth 2.0 Client**
   - Click on your **Web client** (Tendso Web Client)
   - Scroll to **Authorized redirect URIs**
   - Click **"+ Add URI"**
   - Paste the Supabase callback URL you copied:
     ```
     https://your-project-ref.supabase.co/auth/v1/callback
     ```
   - Click **"Save"**

---

## ✅ Testing the Setup

### Test in Development

1. **Start your dev server**:
   ```bash
   npm run dev
   ```

2. **Visit Login or Signup Page**:
   - http://localhost:3000/login
   - http://localhost:3000/signup

3. **Click "Continue with Google"**
   - You should be redirected to Google Sign-In
   - Choose your Google account
   - Grant permissions
   - You'll be redirected back to your app
   - You should be logged in!

### What Happens During Google Sign-In

```
┌─────────────────────────────────────────┐
│  1. User clicks "Continue with Google"  │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  2. Redirect to Google OAuth            │
│     - User selects Google account       │
│     - User grants permissions           │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  3. Google redirects to Supabase        │
│     callback URL with auth code         │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  4. Supabase creates user session       │
│     - Creates user in auth.users        │
│     - Generates access token            │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  5. Redirect to /auth/callback          │
│     - Your app processes callback       │
│     - Creates creator profile (if new)  │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  6. User lands on /dashboard            │
│     - Logged in successfully!           │
└─────────────────────────────────────────┘
```

---

## 🔐 Environment Variables

Make sure your `.env` file has:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## 🐛 Troubleshooting

### Issue: "Access blocked: This app's request is invalid"

**Solution**: Make sure you:
- ✅ Added the correct redirect URI in Google Console
- ✅ Enabled Google+ API
- ✅ Configured OAuth consent screen

### Issue: "Redirect URI mismatch"

**Solution**: 
- Check that the redirect URI in Google Console **exactly matches** the one from Supabase
- It should be: `https://your-project-ref.supabase.co/auth/v1/callback`

### Issue: User signed in but no creator profile

**Solution**:
- The creator profile should be auto-created via the auth callback
- Check your `/auth/callback/route.ts` file
- Make sure it creates a creator profile for new Google users

### Issue: "localhost" not working

**Solution**:
- Add `http://localhost:3000` to **Authorized JavaScript origins** in Google Console
- Make sure you're using `http://` not `https://` for localhost

---

## 📝 Google Sign-In User Data

When a user signs in with Google, Supabase provides:

```typescript
{
  email: "user@gmail.com",
  email_verified: true,
  name: "John Doe",
  picture: "https://lh3.googleusercontent.com/...",
  sub: "google-user-id",
  iss: "https://accounts.google.com",
  // ... more fields
}
```

**Available in your app:**
- `user.email` - User's Google email
- `user.user_metadata.name` - Full name from Google
- `user.user_metadata.avatar_url` - Google profile picture
- `user.user_metadata.picture` - Alternative picture URL

---

## 🎨 Customizing the OAuth Flow

### Change Scopes (Optional)

To request additional Google data:

```typescript
// lib/services/auth.service.ts
async signInWithGoogle() {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
      scopes: 'email profile openid', // Add more scopes here
    },
  })
  if (error) throw error
  return data
}
```

### Auto-Create Creator Profile

Update your `/auth/callback/route.ts` to automatically create a creator profile for Google users:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Get the user
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Check if creator profile exists
        const { data: existing } = await supabase
          .from('creators')
          .select('id')
          .eq('id', user.id)
          .single()
        
        // Create profile if it doesn't exist
        if (!existing) {
          const name = user.user_metadata.full_name || user.user_metadata.name || 'User'
          const placeholderPhone = `PH${user.id.substring(0, 8).toUpperCase()}`
          
          await supabase.from('creators').insert({
            id: user.id,
            phone: placeholderPhone,
            name: name,
            email: user.email,
            password_hash: 'oauth_google',
            referral_code: generateReferralCode(name),
            status: 'active',
          })
        }
      }
      
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
```

---

## ✅ Setup Checklist

- [ ] Created Google Cloud Project
- [ ] Enabled Google+ API
- [ ] Configured OAuth consent screen
- [ ] Created OAuth 2.0 credentials
- [ ] Copied Client ID and Client Secret
- [ ] Enabled Google provider in Supabase
- [ ] Added Google credentials to Supabase
- [ ] Added Supabase callback URL to Google Console
- [ ] Tested Google Sign-In on login page
- [ ] Tested Google Sign-In on signup page
- [ ] Verified creator profile is created for new users

---

## 🚀 You're Done!

Your users can now sign in with Google! The "Continue with Google" button is available on both:
- **/login** page
- **/signup** page

When users sign in with Google for the first time, a creator profile is automatically created for them.

---

## 📚 References

- [Supabase Google OAuth Docs](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)
- [Next.js OAuth Documentation](https://nextjs.org/docs/authentication)

Happy coding! 🎉
