import { google } from 'googleapis';
import { setCookie } from 'nookies';
import { v4 as uuidv4 } from 'uuid';
import { saveTokenToDatabase } from '../../../lib/mongodb';

export default async function handler(req, res) {
  const redirectUri = process.env.GMAIL_REDIRECT_URI;

  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    redirectUri
  );

  // Handle GET request for OAuth2 flow
  if (req.method === 'GET') {
    const { code } = req.query;

    // If authorization code is provided, exchange it for tokens
    if (code) {
      try {
        // Get tokens using the authorization code
        const { tokens } = await oauth2Client.getToken(code);
        
        // Log the tokens for debugging
        console.log('Tokens:', tokens);

        // Generate a new session ID
        const sessionId = uuidv4();
        console.log('Session ID:', sessionId);
        
        // Save tokens and session ID to the database
        const tokenSaved = await saveTokenToDatabase(sessionId, tokens);
        
        if (!tokenSaved) {
          throw new Error('Error saving token to database');
        }

        // Set the session ID as a cookie (secure and httpOnly)
        setCookie({ res }, 'session_id', sessionId, {
          maxAge: 30 * 24 * 60 * 60, // 30 days
          httpOnly: true, // Cookie cannot be accessed via JavaScript
          secure: process.env.NODE_ENV === 'production', // Secure flag only in production
          path: '/', // Cookie available across the whole site
        });

        // Redirect user to homepage after successful authentication
        res.redirect('/');
      } catch (error) {
        console.error('Error getting tokens:', error.message);
        res.redirect('/?auth=error'); // Redirect to error page if token exchange fails
      }
    } else {
      // If no authorization code, generate and redirect to Google's OAuth2 consent screen
      try {
        const authUrl = oauth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.modify',
            'https://www.googleapis.com/auth/gmail.send'
          ],
        });

        // Redirect the user to Google's authentication page
        res.redirect(authUrl);
      } catch (error) {
        console.error('Error generating auth URL:', error);
        res.redirect('/?auth=error'); // Redirect to error page if URL generation fails
      }
    }
  } else {
    // If method is not GET, return 405 (Method Not Allowed)
    res.status(405).end('Method Not Allowed');
  }
}
