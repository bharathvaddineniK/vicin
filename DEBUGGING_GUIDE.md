# Debugging Guide - Sign-in and Feed Issues

## 🔧 Fixes Applied:

### 1. Deep Link Configuration Fixed
- **File**: `app.json`
- **Issue**: Scheme mismatch (`vicin` vs `vicinapp`)
- **Fix**: Updated deep link scheme to `vicinapp` and path to `oauth-callback`

### 2. OAuth Callback Processing Added
- **File**: `lib/deeplink.ts`
- **Issue**: OAuth callbacks were detected but not processed
- **Fix**: Added proper OAuth callback handling with session refresh

### 3. Enhanced Feed Subscription
- **File**: `app/(tabs)/index.tsx`
- **Issue**: Real-time subscription failures without recovery
- **Fix**: Added connection diagnostics, retry logic, and better error handling

### 4. Debug Logging Added
- **Files**: `lib/oauth.ts`, `lib/session.ts`, `lib/deeplink.ts`
- **Purpose**: Track OAuth flow and identify remaining issues

## 🧪 Testing Steps:

### Test 1: Check Current Status
1. Restart your app: `npx expo start --clear`
2. Open the app and check console logs for:
   ```
   Checking Supabase connection...
   Current session: authenticated/not authenticated
   Supabase connection test successful/failed
   ```

### Test 2: Test Google Sign-in
1. Try signing in with Google
2. Look for these console logs:
   ```
   [OAuth] Google redirect URI: [URL]
   [OAuth] Google auth URL: [URL]
   [DeepLink] URL: [callback URL]
   [DeepLink] Is Supabase return: true
   [DeepLink] Processing Supabase OAuth callback
   [Session] Auth state change: SIGNED_IN session exists
   [Session] User authenticated: [email]
   ```

### Test 3: Check Feed Subscription
1. After successful sign-in, look for:
   ```
   ✅ Feed subscription active
   ```
2. If you see errors, the retry logic should limit attempts to 2 retries

## 🚨 Potential Issues to Check:

### If Sign-in Still Fails:

1. **Check Supabase Dashboard**:
   - Go to Authentication > Providers
   - Ensure Google OAuth is enabled
   - Verify redirect URLs include: `https://auth.expo.dev/@bkumarvaddineni/vicin-app/oauth-callback`

2. **Check Google Cloud Console**:
   - Verify OAuth client configuration
   - Ensure redirect URIs match what the app is sending

3. **Environment Variables**:
   - Verify `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are correct
   - Check that Supabase project is not paused

### If Feed Subscription Still Fails:

1. **Check RLS Policies**:
   - Ensure your `posts` table has appropriate Row Level Security policies
   - Verify real-time subscriptions are allowed for authenticated users

2. **Network Issues**:
   - Test on different networks (WiFi vs cellular)
   - Check if corporate firewalls block Supabase connections

3. **Database Permissions**:
   - Verify the authenticated user has SELECT permissions on `posts` table
   - Check if real-time is enabled for the `posts` table in Supabase

## 📋 Console Log Checklist:

When testing, you should see these logs in order:

### App Startup:
- ✅ `Checking Supabase connection...`
- ✅ `Current session: [status]`
- ✅ `Supabase connection test successful`

### OAuth Flow:
- ✅ `[OAuth] Google redirect URI: [URL]`
- ✅ `[OAuth] Google auth URL: [URL]`
- ✅ `[DeepLink] URL: [callback URL]`
- ✅ `[DeepLink] Is Supabase return: true`
- ✅ `[DeepLink] Processing Supabase OAuth callback`
- ✅ `[Session] Auth state change: SIGNED_IN`

### Feed Subscription:
- ✅ `Setting up subscription (attempt 1)`
- ✅ `✅ Feed subscription active`

## 🔍 Next Steps:

1. Run the app and collect console logs
2. Try the Google sign-in flow
3. Share any error messages or unexpected behavior
4. If issues persist, we may need to check Supabase dashboard configuration

The main fixes address the OAuth callback processing (which was completely missing) and improve the feed subscription reliability. The debug logs will help identify any remaining configuration issues.
