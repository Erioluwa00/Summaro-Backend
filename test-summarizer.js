// test-summarizer.js
const summarizer = require('./src/services/summarizer');

// Test with different types of voice notes
const testCases = [
  {
    name: "Business Meeting",
    text: `Okay team, let's start the meeting. First item on the agenda is the Q3 product roadmap. We need to finalize the features for the next release. John, can you update us on the authentication system? The security audit showed some vulnerabilities we need to fix. This is critical and must be done by Friday. Next, the dashboard redesign. Sarah, the designs look good but we need to start development next week. Finally, API integrations. We don't have enough backend engineers right now, so let's push this to Q4. I'll inform the marketing team about the timeline change. Action items: John fixes auth by Friday, Sarah starts dashboard development, and I'll email marketing. Meeting adjourned.`
  },
  {
    name: "Nigerian Business Discussion",
    text: `Good morning everyone. Make we start with the project update. Omo, the client dey expect delivery by Friday. We need to complete the user authentication first. That one na priority. Sarah, abeg make you handle the dashboard design. The wireframes don ready since last week. John, you go handle the backend integration. But wait oh, we no get enough engineers for the API part. Make we shift that one to next month. Important things: authentication must work well, dashboard must look clean. Please everyone, try finish your work by Thursday so we fit review on Friday. That's all.`
  },
  {
    name: "Lecture Notes",
    text: `Today we're discussing machine learning fundamentals. There are three main types of machine learning: supervised, unsupervised, and reinforcement learning. Supervised learning requires labeled data. Examples include classification and regression. Unsupervised learning finds patterns in unlabeled data. Clustering is a common example. Reinforcement learning is about agents learning from rewards. Key takeaway: choose the right algorithm for your problem. Next week we'll cover neural networks. Please read chapter 5 before the next class.`
  },
  {
    name: "Short Voice Note",
    text: `Just a quick note. Call the client tomorrow. Send the proposal. That's it.`
  }
];

console.log('🧪 Testing Summarizer Algorithm\n');

testCases.forEach((testCase, index) => {
  console.log(`\n📋 Test ${index + 1}: ${testCase.name}`);
  console.log('─'.repeat(50));
  
  console.log('\n📝 Original Text:');
  console.log(testCase.text);
  
  console.log('\n✨ Generated Summary:');
  const summary = summarizer.summarize(testCase.text);
  console.log(summary);
  
  console.log('\n✅ Action Items:');
  const actionItems = summarizer.extractActionItems(testCase.text);
  actionItems.forEach((item, i) => {
    console.log(`${i + 1}. ${item}`);
  });
  
  console.log('\n📊 Stats:');
  console.log(`Original: ${testCase.text.length} chars`);
  console.log(`Summary: ${summary.length} chars (${Math.round((summary.length / testCase.text.length) * 100)}%)`);
  console.log(`Action items found: ${actionItems.length}`);
  console.log('─'.repeat(50));
});