// This is a Node.js serverless function
// It uses the GitHub API to append an email to a file in your repository.

// We use the 'node-fetch' package to make HTTP requests to the GitHub API.
// You'll need to add "node-fetch": "^2.6.7" to your package.json dependencies.
// If you don't have a package.json, run `npm init -y` in your project root.
// Then run `npm install node-fetch@2`.
import fetch from 'node-fetch';

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).end('Method Not Allowed');
    }

    const { email } = req.body;

    // Basic email validation
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
        return res.status(400).json({ message: 'Invalid email address provided.' });
    }

    // Retrieve environment variables securely stored on Vercel
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const GITHUB_REPO = process.env.GITHUB_REPO;
    const GITHUB_OWNER = process.env.GITHUB_OWNER;
    const FILE_PATH = process.env.EMAIL_FILE_PATH || 'subscribers.txt';
    const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`;

    try {
        // Step 1: Get the current file content from GitHub to get its SHA
        const getFileResponse = await fetch(GITHUB_API_URL, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });

        let fileSha = null;
        let currentContent = '';

        if (getFileResponse.ok) {
            const fileData = await getFileResponse.json();
            fileSha = fileData.sha;
            // Content is base64 encoded, so we need to decode it
            currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
        } else if (getFileResponse.status !== 404) {
            // If it's any error other than "Not Found", throw it
            throw new Error(`Failed to get file from GitHub: ${getFileResponse.statusText}`);
        }

        // Step 2: Prepare the new content
        // Append the new email on a new line.
        const newContent = currentContent ? `${currentContent}\n${email}` : email;
        const newContentEncoded = Buffer.from(newContent).toString('base64');

        // Step 3: Create or update the file on GitHub
        const updateFileResponse = await fetch(GITHUB_API_URL, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: `feat: Add new subscriber ${email}`, // Commit message
                content: newContentEncoded,
                sha: fileSha, // Include the SHA if updating an existing file
            }),
        });

        if (!updateFileResponse.ok) {
            const errorBody = await updateFileResponse.json();
            console.error('GitHub API Error:', errorBody);
            throw new Error(`Failed to update file on GitHub: ${updateFileResponse.statusText}`);
        }

        // Success!
        return res.status(200).json({ message: 'Successfully subscribed!' });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'An internal server error occurred.' });
    }
}
