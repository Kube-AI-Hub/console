import React from "react";

export default function Access() {
  
  return (
    <div>
      <h1>Internet Access</h1>
      <p>Configure internet access settings for your project.</p>
      <div>
        <label htmlFor="internet-access">Internet Access:</label>
        <select id="internet-access">
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>
      </div>
      <div>
        <label htmlFor="proxy-settings">Proxy Settings:</label>
        <input type="text" id="proxy-settings" placeholder="Enter proxy settings" />
      </div>
    </div>
  );
}