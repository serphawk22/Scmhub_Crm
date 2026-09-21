# Developer Git Workflow

This guide outlines the standard Git workflow for our team. Follow these steps to claim a ticket, write code, and submit your work for review.

## Step 1: Clone the Repository (First Time Only)
If you haven't downloaded the codebase to your local machine yet, clone the repository and navigate into it:
```bash
git clone https://github.com/serphawk22/serphawk_crm_seo.git
cd serphawk_crm_seo
```

## Step 2: Fetch and Checkout Your Branch
Before starting work, ensure your local Git knows about all the latest branches on the remote server, then switch to the branch you've been assigned.

```bash
# Update your local git with the latest remote branches
git fetch origin

# Switch to your assigned branch (replace with your actual branch name)
git checkout feat/your-assigned-branch
```

## Step 3: Read the Ticket & Write Code
As soon as you check out the branch, look for the `TICKET.md` file in the root folder. 
1. Open `TICKET.md` to read your exact requirements, tasks, and Acceptance Criteria.
2. Write the code to fulfill those requirements.

## Step 4: Commit Your Changes
Once you have written and tested your code, save your changes with a descriptive commit message.

```bash
# Stage all the changed files
git add .

# Create a commit message explaining what you built
git commit -m "feat: added endpoints and UI for the new feature"
```

## Step 5: Push the Code
Send your committed code back to the GitHub server.

```bash
git push origin feat/your-assigned-branch
```

## Step 6: Open a Pull Request
1. Open your web browser and go to the GitHub repository: `https://github.com/serphawk22/serphawk_crm_seo`
2. You will automatically see a green button that says **"Compare & pull request"** near the top of the page.
3. Click it, review your changes, and submit the Pull Request for the Lead Engineer to review.

## Step 7: Start Your Next Task
Once your Pull Request is approved and merged into `main`, sync your local environment and move to your next branch:

```bash
# Switch back to main
git checkout main

# Pull the latest merged code
git pull

# Switch to your next assigned branch
git checkout feat/your-next-branch
```
