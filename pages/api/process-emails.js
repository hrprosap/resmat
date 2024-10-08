import { extractResumeText } from '../../lib/emailParser';
import { getGmailService, getEmailContent, getEmailMetadata } from '../../lib/gmail';
import { connectToDatabase } from '../../lib/mongodb';
import { getResumeScore } from '../../lib/openai';
import { simpleParser } from 'mailparser';
import { ObjectId } from 'mongodb';
import { google } from 'googleapis';
 // Import nodemailer at the top




 
 export default async function handler(req, res) {
   console.log('Process emails handler called');
   console.log('Request method:', req.method);
   console.log('Request body:', req.body);
 
   if (req.method !== 'POST') {
     console.log('Method not allowed');
     return res.status(405).json({ error: 'Method not allowed' });
   }
 
   try {
     console.log('Connecting to database...');
     const db = await connectToDatabase();
     console.log('Connected to database. Searching for active job description...');
 
     const { activeJobId } = req.body;
     if (!activeJobId) {
       console.log('No active job ID provided');
       return res.status(400).json({ error: 'No active job ID provided' });
     }
 
     console.log('Fetching job description for ID:', activeJobId);
     const jobDescription = await db.collection('jobs').findOne({ _id: ObjectId(activeJobId) });
 
     if (!jobDescription) {
       console.log('No job description found for ID:', activeJobId);
       return res.status(404).json({ error: 'No job description found for the provided ID' });
     }
 
     console.log('Job description found:', jobDescription);
 
     console.log('Initializing Gmail service...');
     const gmail = await getGmailService(req);
     console.log('Gmail service initialized');
 
     let response;
     try {
       response = await gmail.users.messages.list({
         userId: 'me',
         q: `subject:(${jobDescription.title}) OR subject:(${jobDescription.title.toUpperCase()}) OR subject:(${jobDescription.title.toLowerCase()}) is:unread`,
         maxResults: 100
       });
       console.log('Gmail API response:', JSON.stringify(response, null, 2));
     } catch (error) {
       console.error('Error fetching emails from Gmail:', error);
       return res.status(500).json({ error: 'Failed to fetch emails from Gmail' });
     }
 
     if (!response || !response.data) {
       console.error('Unexpected response structure from Gmail API:', response);
       return res.status(500).json({ error: 'Unexpected response from Gmail API' });
     }
 
     const messages = response.data.messages || [];
     console.log(`Found ${messages.length} new emails matching the job title.`);
 
     let processedEmails = [];
 
     if (messages.length === 0) {
       console.log('No new emails found. Fetching previous applicants from database.');
       processedEmails = await db.collection('applications')
         .find({ jobId: jobDescription._id })
         .sort({ timestamp: -1 })
         .toArray();
     } else {
       // Process new emails
       for (const message of messages) {
         try {
           const emailContent = await getEmailContent(gmail, message.id);
           const emailMetadata = await getEmailMetadata(gmail, message.id);
           const resumeText = await extractResumeText(emailContent);
 
           console.log('Resume Text:', resumeText.substring(0, 200) + '...');
           console.log('Job Description:', jobDescription.description.substring(0, 200) + '...');
 
           const score = await getResumeScore(resumeText, jobDescription.description, db, message.id);
           console.log(`Email ${message.id} received a score of ${score}`);
 
           const applicationData = {
             emailId: message.id,
             applicantEmail: emailMetadata.from,
             jobTitle: jobDescription.title,
             subjectLine: emailMetadata.subject,
             score: score,
             resumeText: resumeText,
             timestamp: new Date(),
             jobId: jobDescription._id,
             applicationId: new ObjectId()
           };
 
           await db.collection('applications').insertOne(applicationData);
 
           processedEmails.push(applicationData);
 
           // Mark the email as read after processing
           await gmail.users.messages.modify({
             userId: 'me',
             id: message.id,
             requestBody: {
               removeLabelIds: ['UNREAD']
             }
           });
         } catch (emailError) {
           console.error(`Error processing email ${message.id}:`, emailError);
         }
       }
     }
 
     console.log('All emails processed successfully.');
     res.status(200).json({
       message: messages.length === 0 ? 'No new emails found. Showing previous applicants.' : 'Emails processed successfully',
       processedEmails: processedEmails
     });
   } catch (error) {
     console.error('Error processing emails:', error);
     res.status(500).json({ error: error.message || 'An error occurred while processing emails' });
   }
 }