import React, { useState } from 'react';
import api from '../api';
import './InviteManager.css';

function InviteManager({ restaurantId }) {
    const [inviteLink, setInviteLink] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const generateInviteLink = async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await api.post('/api/create-invite', {
                restaurantId: restaurantId,
            });

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
        <div className="invite-manager-container">
            <h4>Invite New User</h4>
            <p>Generate a unique sign-up link to share with new users.</p>
            <button onClick={generateInviteLink} disabled={isLoading} className="generate-invite-btn">
                {isLoading ? 'Generating...' : 'Generate Invite Link'}
            </button>
            {error && <p className="error-message">{error}</p>}
            {inviteLink && (
                <div className="invite-link-container">
                    <p>Share this link with your new user:</p>
                    <div className="invite-link-box">
                        <input type="text" value={inviteLink} readOnly />
                        <button onClick={copyToClipboard}>Copy</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default InviteManager;