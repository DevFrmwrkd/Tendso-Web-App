# Gmail Email Setup Guide

This guide will help you set up email notifications using Gmail and App Passwords.

---

## Step 1: Create a Gmail App Password

1. **Go to your Google Account**: https://myaccount.google.com/
2. **Navigate to Security**: Click "Security" in the left sidebar
3. **Enable 2-Step Verification** (if not already enabled):
   - Scroll to "How you sign in to Google"
   - Click "2-Step Verification"
   - Follow the setup process
4. **Create App Password**:
   - Go back to Security
   - Scroll to "How you sign in to Google"
   - Click "App passwords" (or "2-Step Verification" → "App passwords")
   - Select "Mail" as the app
   - Select "Other" as the device and name it "Tendso"
   - Click "Generate"
   - **Copy the 16-character password** (you won't see it again!)

---

## Step 2: Add Environment Variables

Add these to your `.env.local` file:

```env
# Gmail Configuration
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-character-app-password

# Payment Details
NEXT_PUBLIC_PAYMENT_GCASH_NUMBER=09171234567
NEXT_PUBLIC_PAYMENT_GCASH_NAME="Your Name or Business Name"
```

**Example:**
```env
GMAIL_USER=negosyodigital@gmail.com
GMAIL_APP_PASSWORD=abcd efgh ijkl mnop
NEXT_PUBLIC_PAYMENT_GCASH_NUMBER=09171234567
NEXT_PUBLIC_PAYMENT_GCASH_NAME="Tendso"
```

---

## Step 3: Restart Your Dev Server

After adding the environment variables:

```bash
# Stop the current dev server (Ctrl+C)
npm run dev
```

---

## Step 4: Test Email Sending

1. Go to admin dashboard
2. Open a submission
3. Click "Approve"
4. Check the business owner's email inbox
5. Verify the email was received with:
   - Website link
   - GCash payment details
   - Payment instructions

---

## Troubleshooting

### "Invalid login" error
- Make sure 2-Step Verification is enabled
- Regenerate the App Password
- Double-check the email and password in `.env.local`
- Ensure no extra spaces in the password

### Email not sending
- Check the terminal/console for error messages
- Verify the business owner's email is valid
- Check Gmail's "Sent" folder
- Make sure you restarted the dev server after adding env variables

### Email goes to spam
- Ask recipients to mark as "Not Spam"
- Consider using a custom domain email (requires more setup)
- Add SPF/DKIM records (advanced)

---

## Security Notes

⚠️ **Important:**
- Never commit `.env.local` to Git
- The App Password is different from your Gmail password
- You can revoke App Passwords anytime from Google Account settings
- Each App Password is unique to one application

---

## Production Deployment

When deploying to production (Vercel, etc.):

1. Add the same environment variables to your hosting platform
2. Use a dedicated business Gmail account (not personal)
3. Consider using a professional email service for higher volume:
   - SendGrid (100 emails/day free)
   - Resend (3,000 emails/month free)
   - AWS SES (62,000 emails/month free)

---

## Email Template Customization

The email template is in: `lib/email/service.ts`

You can customize:
- Email subject line (line 44)
- Sender name (line 43)
- Email HTML content (in `getApprovalEmailTemplate` function)
- Payment instructions
- Branding and colors
