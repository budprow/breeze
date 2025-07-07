import React, { useState } from 'react';
import axios from 'axios';
import { auth } from '../firebase'; // Import auth to get the current user
import './StaffManager.css';

function StaffManager({ restaurantId }) {
    const [inviteLink, setInviteLink] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const generateInviteLink = async () => {
        setIsLoading(true);
        setError('');
        try {
            const user = auth.currentUser;
            if (!user) {
                throw new Error("You must be logged in to create an invite.");
            }

            // Get the user's Firebase ID token for secure backend authentication
            const idToken = await user.getIdToken();
            
            const createInviteUrl = "https://us-central1-breeze-9c703.cloudfunctions.net/api/create-invite"; // <-- Paste your URL here
            const response = await axios.post(createInviteUrl, 
                {
                    restaurantId: restaurantId,
                    managerId: user.uid
                }, 
                {
                    headers: {
                        'Authorization': `Bearer ${idToken}`
                    }
                }
            );

            const { inviteCode } = response.data;
            const baseUrl = window.location.origin;
            setInviteLink(`${baseUrl}/?invite=${inviteCode}`);

        } catch (err) {
            console.error("Error generating invite link:", err);
            setError("Could not generate invite link. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = () => {
        if (!inviteLink) return;
        navigator.clipboard.writeText(inviteLink).then(() => {
            alert('Invite link copied to clipboard!');
        }, (err) => {
            console.error('Could not copy text: ', err);
            alert('Failed to copy link.');
        });
    };

    return (
        <div className="staff-manager-container">
            <h4>Invite New Staff</h4>
            <p>Generate a unique sign-up link to share with your new employees.</p>
            
            <button onClick={generateInviteLink} disabled={isLoading} className="generate-invite-btn">
                {isLoading ? 'Generating...' : 'Generate Invite Link'}
            </button>

            {error && <p className="error-message">{error}</p>}

            {inviteLink && (
                <div className="invite-link-container">
                    <p>Share this link with your new staff member:</p>
                    <div className="invite-link-box">
                        <input type="text" value={inviteLink} readOnly />
                        <button onClick={copyToClipboard}>Copy</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default StaffManager;