# 🚀 Production Setup Checklist

Complete this checklist before deploying to production on Vercel.

---

## 1. ✅ Environment Variables

Create/update these in **Vercel Dashboard** → Project Settings → Environment Variables

### **Required for All Environments** (Production, Preview, Development)

```env
# ==================== CONVEX ====================
NEXT_PUBLIC_CONVEX_URL=https://diligent-ibex-454.convex.cloud
# (Already configured - verified in .env.local)

# ==================== CLERK AUTHENTICATION ====================
# Get from: https://dashboard.clerk.com
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...

# ==================== SUPABASE (Database) ====================
# Get from: https://supabase.com/dashboard
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-url.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# ==================== WISE PAYMENT ====================
# Your Wise account email (shown to customers)
WISE_EMAIL=your-wise-email@example.com
NEXT_PUBLIC_WISE_EMAIL=your-wise-email@example.com
WISE_ACCOUNT_NAME=Tendso

# ==================== GMAIL SMTP (Email Service) ====================
GMAIL_USER=your-gmail@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx  # 16-char app password

# ==================== CLOUDFLARE (Website Hosting) ====================
# Get from: https://dash.cloudflare.com
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ACCOUNT_ID=your_account_id

# ==================== GROQ API (AI Processing) ====================
GROQ_API_KEY=gsk_...

# ==================== APP CONFIGURATION ====================
NEXT_PUBLIC_SITE_URL=https://tendso.vercel.app
NEXT_PUBLIC_APP_URL=https://tendso.vercel.app  # For payment links
```

### **Payment Gateway Options** (GCash/Maya - Optional for now)
```env
NEXT_PUBLIC_PAYMENT_GCASH_NUMBER=09171234567
NEXT_PUBLIC_PAYMENT_GCASH_NAME="Your Business Name"
```

---

## 2. 🔐 Secure Credentials Setup

### **Gmail App Password (SMTP)**
1. Go to: https://myaccount.google.com/security
2. Enable 2-Factor Authentication if not already done
3. Generate App Password for "Mail" → "Windows PC"
4. Copy the 16-character password to: `GMAIL_APP_PASSWORD`
5. Test in `.env.local` first:
   ```env
   GMAIL_USER=your-email@gmail.com
   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
   ```

### **Clerk Production Keys**
1. Log in to: https://dashboard.clerk.com
2. Navigate to: API Keys
3. Copy Live Key values (NOT test keys)
4. Update in Vercel → Environment Variables:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`

### **Cloudflare API Token**
1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Create token with:
   - Permissions: **Account.Pages Write**
   - Zone Resources: **All zones** (or specific domain)
3. Copy to Vercel: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`

### **Wise Account Setup**
1. Go to: https://wise.com/
2. Log in to your business account
3. Your registered email = `WISE_EMAIL`
4. Verify Wise account is active and can receive transfers
5. Set in Vercel: `WISE_EMAIL`, `NEXT_PUBLIC_WISE_EMAIL`

---

## 3. 🗄️ Database Setup

### **Supabase (PostgreSQL)**
- ✅ Already configured in `.env`
- Verify tables exist:
  - `submissions` - business submissions
  - `creators` - user/creator accounts
  - `earnings` - payment records
  - `withdrawals` - withdrawal requests

### **Convex**
- ✅ Already deployed to: `diligent-ibex-454.convex.cloud`
- Schema deployed and active
- Tables: `paymentTokens`, `submissions`, `creators`, etc.

---

## 4. 🔗 Domain & SSL Setup

### **Current Domain**
```
Production: https://tendso.vercel.app
```

### **Custom Domain (Optional - if you own one)**
1. In Vercel: Project Settings → Domains
2. Add your domain
3. Update Vercel DNS records or CNAME
4. Set SSL: Auto (Vercel handles this)

### **Update Credentials**
```env
NEXT_PUBLIC_SITE_URL=https://your-domain.com  # Update this
NEXT_PUBLIC_APP_URL=https://your-domain.com   # Same for payment links
```

---

## 5. 🔔 Webhook Configuration

### **Payment Confirmation Webhook**
**Location:** `/api/mark-paid`
- Receives payment confirmations from Wise
- Process when business owner confirms payment
- Current: Works with manual payment confirmation

### **Website Unpublish Cron**
- Runs hourly to auto-unpublish sites if payment not received within 3 days
- No external webhook needed (automated by Convex cron)

---

## 6. ✉️ Email Configuration

### **Test Email Setup Locally First**
```bash
# Update .env.local with test credentials
npm run dev

# Test email in admin panel or submit a test payment
# Should receive:
# - Payment link email
# - Confirmation emails
# - Admin notifications
```

### **Production Email Testing**
1. Deploy to Vercel with real Gmail credentials
2. Send test email from admin panel
3. Verify delivery and formatting

---

## 7. 🏃 Pre-Production Checklist

- [ ] Build passes locally: `npm run build` → 0 errors
- [ ] All env vars set in Vercel
- [ ] Test in Preview environment first (before Production)
- [ ] Verify email delivery (test@example.com)
- [ ] Test payment flow from start to finish
- [ ] Check payment page displays correctly
- [ ] Verify withdrawal process works
- [ ] Test admin dashboard functionality
- [ ] Verify image uploads work (R2 storage)
- [ ] Check mobile responsive design

---

## 8. 📋 Deployment Steps

### **Step 1: Sync Environment Variables**
```
Vercel Dashboard → Project Settings → Environment Variables
Copy all variables from checklist section 1
```

### **Step 2: Deploy Preview First**
```bash
git push origin develop  # Deploy to preview
# Wait for Vercel build to complete
# Test on preview.tendso.vercel.app
```

### **Step 3: Promote to Production**
```bash
git push origin main  # Deploy to production
# Wait for build completion
# Production now live at: tendso.vercel.app
```

### **Step 4: Post-Deployment Verification**
- [ ] App loads without errors
- [ ] Clerk authentication works
- [ ] Dashboard accessible
- [ ] Send test email from admin
- [ ] Create test submission → verify payment link working
- [ ] Test payment token generation
- [ ] Verify database queries working

---

## 9. 🆘 Troubleshooting

### **Build Fails**
```bash
# Check logs
npm run build

# Common issues:
# 1. Missing env vars → Check Vercel dashboard
# 2. Type errors → Run locally first: npm run build
# 3. Convex schema issues → Verify schema deployed
```

### **Emails Not Sending**
```
Check: GMAIL_USER and GMAIL_APP_PASSWORD
- Verify Gmail app password (not regular password)
- Enable "Less Secure App Access" if using regular password
- Check spam folder
```

### **Payment Page Not Loading**
```
Check: NEXT_PUBLIC_CONVEX_URL
- Verify Convex deployment URL correct in .env
- Check payment tokens table exists in Convex
```

### **Wise Credentials Not Working**
```
Check: WISE_EMAIL, NEXT_PUBLIC_WISE_EMAIL
- Verify Wise account is active
- Check email matches your Wise account exactly
- Ensure Wise can receive bank transfers
```

---

## 10. 🔒 Production Security Notes

1. **Never commit `.env` files** to git
2. **Use secret keys only in Vercel** (not in code)
3. **Enable HTTPS** (Vercel: automatic)
4. **Set up rate limiting** for API endpoints (optional: Vercel Edge Functions)
5. **Monitor logs** for errors and suspicious activity
6. **Backup Supabase database regularly**
7. **Review Cloudflare security settings**

---

## 11. 📊 Monitoring

### **Enable Logs**
- Vercel: Project → Deployments → View build logs
- Convex: https://diligent-ibex-454.convex.cloud → Dev Stack
- Supabase: https://supabase.com/dashboard → Logs

### **Key Metrics to Watch**
- Email delivery success rate
- Payment token generation rate
- Website publish/unpublish events
- Withdrawal requests and completion rate
- Clerk authentication errors

---

## 12. ✨ Final Deployment

Once everything is tested and verified in the checklist above, you're ready for production!

```bash
# Final steps
git push origin main

# Monitor in Vercel dashboard
# Check app at: https://tendso.vercel.app
```

**Estimated setup time:** 30-45 minutes
