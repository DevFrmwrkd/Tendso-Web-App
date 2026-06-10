# Tendso - Authentication Setup Guide

## 🎯 Overview

This authentication system uses **Supabase** for secure user management with a modern black & white design aesthetic.

## ✅ What's Included

### Authentication Features
- ✅ Email/Password signup
- ✅ Email/Password login  
- ✅ Protected routes with middleware
- ✅ Server-side session management
- ✅ Automatic redirects for authenticated users
- ✅ Creator profile creation on signup

### UI Components
- ✅ Modern Input component
- ✅ Button component (default, outline, ghost variants)
- ✅ Label component
- ✅ Container layout component
- ✅ Header component

### Pages
- ✅ Landing page (/)
- ✅ Signup page (/signup)
- ✅ Login page (/login)
- ✅ Dashboard page (/dashboard) - Protected
- ✅ Auth callback handler (/auth/callback)

## 🚀 Setup Instructions

### 1. Environment Variables

Create a `.env` file in the root directory:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

You can find these credentials in your Supabase project:
1. Go to [https://supabase.com](https://supabase.com)
2. Select your project
3. Go to Settings → API
4. Copy the URL and anon/public key

### 2. Database Setup

Run the SQL from `docs/DATABASE.sql` in your Supabase SQL Editor:

1. Go to your Supabase project
2. Click on "SQL Editor" in the left sidebar
3. Click "New query"
4. Paste the contents of `docs/DATABASE.sql`
5. Click "Run"

This will create:
- `creators` table with proper schema
- Row Level Security (RLS) policies
- Indexes for performance
- Auto-update triggers

### 3. Install Dependencies

Dependencies are already installed:
- `@supabase/supabase-js` - Supabase JavaScript client
- `@supabase/ssr` - Server-side rendering support

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📱 User Flow

### New Users
1. Visit landing page (/)
2. Click "Get Started Free"
3. Fill out signup form
4. Account is created in Supabase Auth
5. Creator profile is created in `creators` table
6. Redirect to dashboard

### Returning Users
1. Visit landing page (/)
2. Click "Log In"
3. Enter credentials
4. Redirect to dashboard

### Protected Routes
- Any route not starting with `/login`, `/signup`, or `/auth` requires authentication
- Unauthenticated users are automatically redirected to `/login`
- Authenticated users visiting `/` are redirected to `/dashboard`

## 🎨 Design System

### Colors
- **Black**: `#000000` / `zinc-900`
- **White**: `#FFFFFF`
- **Gray tones**: `zinc-50` through `zinc-900`

### Typography
- **Headings**: Font-black (900 weight), tracking-tight
- **Body**: Font-semibold (600 weight) for labels, regular for content
- **Font**: Geist Sans (already configured)

### Components
- **Borders**: Bold 2-4px borders in black
- **Shadows**: Neo-brutalist style `shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]`
- **Buttons**: Active scale effect `active:scale-[0.98]`
- **Focus**: Ring-2 with ring-zinc-900

## 🔐 Security Features

### Row Level Security (RLS)
- Users can only view/edit their own profiles
- Public can view verified creators
- All policies are defined in `DATABASE.sql`

### Server-Side Authentication
- Middleware checks authentication on every request
- Session cookies are httpOnly and secure
- Server components verify authentication before rendering

### Password Requirements
- Minimum 6 characters (Supabase default)
- Can be customized in Supabase Auth settings

## 📂 Project Structure

```
app/
├── auth/
│   └── callback/
│       └── route.ts          # OAuth & email confirmation handler
├── dashboard/
│   └── page.tsx              # Protected dashboard
├── login/
│   └── page.tsx              # Login page
├── signup/
│   └── page.tsx              # Signup page
├── globals.css               # Global styles
├── layout.tsx                # Root layout
└── page.tsx                  # Landing page

components/
├── layout/
│   ├── container.tsx         # Layout container
│   └── header.tsx            # App header
└── ui/
    ├── button.tsx            # Button component
    ├── input.tsx             # Input component
    └── label.tsx             # Label component

lib/
└── supabase/
    ├── client.ts             # Browser client
    ├── middleware.ts         # Auth middleware
    └── server.ts             # Server client

middleware.ts                 # Next.js middleware
```

## 🧪 Testing the System

### Test Signup Flow
1. Go to `/signup`
2. Fill in:
   - Full Name: "Test User"
   - Business Name: "Test Business"  
   - Email: "test@example.com"
   - Password: "password123"
3. Submit form
4. Check Supabase Auth dashboard for new user
5. Check `creators` table for new profile
6. Verify redirect to dashboard

### Test Login Flow
1. Go to `/login`
2. Enter credentials
3. Verify redirect to dashboard
4. Check that user info is displayed

### Test Protected Routes
1. Log out or open incognito window
2. Try to access `/dashboard`
3. Verify redirect to `/login`

### Test Auto-Redirect
1. Log in
2. Try to visit `/` (landing page)
3. Verify redirect to `/dashboard`

## 🎯 Next Steps

### Recommended Enhancements
1. **Email Verification**
   - Enable in Supabase Auth settings
   - Customize email templates

2. **Password Reset**
   - Create `/forgot-password` page
   - Implement password reset flow

3. **Profile Management**
   - Create `/profile` page
   - Allow users to update profile info
   - Add avatar upload

4. **Social Login**
   - Add OAuth providers (Google, Facebook)
   - Configure in Supabase Auth

5. **Enhanced Security**
   - Add 2FA support
   - Implement rate limiting
   - Add CAPTCHA for signup

## 📚 Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Supabase SSR Guide](https://supabase.com/docs/guides/auth/server-side/nextjs)

## 🐛 Troubleshooting

### "Invalid login credentials" error
- Check that email/password are correct
- Verify user exists in Supabase Auth dashboard

### Middleware not working
- Check that `middleware.ts` is in the root directory
- Verify environment variables are set correctly
- Clear cookies and try again

### Creator profile not created
- Check Supabase logs for errors
- Verify RLS policies are configured
- Check that `creators` table exists

### Redirects not working
- Clear browser cache
- Check Next.js console for errors
- Verify Supabase client initialization

## 💡 Tips

- Always use server components for auth checks when possible
- Keep sensitive operations server-side
- Use the browser client only in client components
- Leverage RLS policies for data security
- Test auth flows in incognito mode
