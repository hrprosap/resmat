import { google } from 'googleapis';
import { parseCookies } from 'nookies';
import { getTokenFromDatabase, updateTokenInDatabase } from './mongodb';

export async function getGmailService(req) {
  const cookies = parseCookies({ req });
  console.log('Cookies:', cookies);
  const sessionId = cookies.session_id;

  // Check if session ID is present
  if (!sessionId) {
    throw new Error('No session ID found');
  }

  // Fetch tokens associated with the session ID
  const tokens = await getTokenFromDatabase(sessionId);
  if (!tokens) {
    throw new Error('No tokens found for this session');
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );

  oauth2Client.setCredentials(tokens);

  try {
    // Verify token and refresh if expired
    const tokenInfo = await oauth2Client.getTokenInfo(tokens.access_token);
    if (tokenInfo.expiry_date <= Date.now()) {
      console.log('Access token expired, refreshing...');
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);

      // Update tokens in the database
      await updateTokenInDatabase(sessionId, credentials);
    }
  } catch (error) {
    console.error('Error refreshing access token:', error);
    throw new Error('Failed to refresh access token. Please authenticate again.');
  }

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

export async function getEmailContent(gmail, messageId) {
  try {
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching email content:', error);
    throw new Error('Could not fetch email content.');
  }
}

export async function getEmailMetadata(gmail, messageId) {
  try {
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'metadata',
      metadataHeaders: ['From', 'Subject'],
    });

    const fromHeader = response.data.payload.headers.find(header => header.name === 'From');
    const subjectHeader = response.data.payload.headers.find(header => header.name === 'Subject');

    // Validate headers before accessing their values
    const from = fromHeader ? fromHeader.value : 'Unknown sender';
    const subject = subjectHeader ? subjectHeader.value : 'No subject';

    return { from, subject };
  } catch (error) {
    console.error('Error fetching email metadata:', error);
    throw new Error('Could not fetch email metadata.');
  }
}
