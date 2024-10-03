import React from 'react';

const ProcessedEmails = ({ emails }) => {
  if (emails.length === 0) {
    return <div className="text-center text-gray-600">No emails processed yet.</div>;
  }
  return (
    <div className="space-y-6">
      {emails.map((email, index) => (
        <div key={index} className="bg-white shadow-md rounded-lg p-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <p><strong className="text-gray-700">Applicant Email:</strong> {email.applicantEmail}</p>
            <p><strong className="text-gray-700">Job Title:</strong> {email.jobTitle}</p>
            <p><strong className="text-gray-700">Score:</strong> <span className="text-lg font-semibold">{email.score}</span></p>
          </div>
          <p className="mb-4"><strong className="text-gray-700">Resume Text:</strong> <span className="text-gray-600">{email.resumeText.substring(0, 100)}...</span></p>
          <a 
            href={`/api/download-resume?emailId=${email.emailId}`} 
            className="text-blue-500 hover:text-blue-700 font-medium"
            target="_blank" 
            rel="noopener noreferrer"
          >
            Download Resume
          </a>
        </div>
      ))}
    </div>
  );
};

export default ProcessedEmails;