import { parseCookies } from 'nookies';

export default async function handler(req, res) {
  const cookies = parseCookies({ req });
  const isAuthenticated = !!cookies.access_token && !!cookies.session_id;

  if (!isAuthenticated) {
    res.status(401).json({ isAuthenticated: false, error: 'Session or access token missing' });
  } else {
    res.status(200).json({ isAuthenticated: true });
  }
}
