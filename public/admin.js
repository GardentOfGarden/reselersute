<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Eclipse | Reseller Panel</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="sidebar">
    <div class="logo">Eclipse | Reseller Panel</div>
    <ul class="menu">
      <li class="active" data-section="generate">Generate Key</li>
      <li data-section="history">History</li>
      <li data-section="settings">Settings</li>
    </ul>
  </div>

  <div class="main">
    <!-- Generate Key Section -->
    <section id="generate" class="section active">
      <h2>Generate Key</h2>
      <form id="keyForm">
        <label for="duration">Duration:</label>
        <input type="number" id="duration" placeholder="Enter amount" min="1" required>
        <select id="unit">
          <option value="seconds">Seconds</option>
          <option value="minutes">Minutes</option>
          <option value="hours">Hours</option>
          <option value="days" selected>Days</option>
          <option value="weeks">Weeks</option>
          <option value="months">Months</option>
          <option value="years">Years</option>
        </select>
        <button type="submit">Generate</button>
      </form>
      <div id="generatedKey"></div>
    </section>

    <!-- History Section -->
    <section id="history" class="section">
      <h2>History</h2>
      <table id="keyHistory">
        <thead>
          <tr>
            <th>Key</th>
            <th>Duration</th>
            <th>Status</th>
            <th>Created At</th>
          </tr>
        </thead>
        <tbody>
          <!-- Filled dynamically -->
        </tbody>
      </table>
    </section>

    <!-- Settings Section -->
    <section id="settings" class="section">
      <h2>Settings</h2>
      <form id="settingsForm">
        <label for="newPassword">Change Admin Password:</label>
        <input type="password" id="newPassword" placeholder="New password">
        <button type="submit">Save</button>
      </form>
    </section>
  </div>

  <script src="script.js"></script>
</body>
</html>
