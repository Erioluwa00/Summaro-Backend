// // summaro-backend/src/services/summarizer.js
// class Summarizer {

//   /**
//    * Main function: Summarize text
//    * @param {string} text - The transcript to summarize
//    * @param {number} targetLength - Target summary length in sentences
//    * @returns {string} - The summary
//    */
//   summarize(text, targetLength = 3) {
//     try {
//       console.log(`📝 Summarizing ${text.length} characters...`);
      
//       // Step 1: Clean and prepare text
//       const sentences = this.extractSentences(text);
      
//       if (sentences.length <= targetLength) {
//         return text; // Too short to summarize
//       }
      
//       // Step 2: Score each sentence
//       const scoredSentences = this.scoreSentences(sentences);
      
//       // Step 3: Select top sentences
//       const selectedSentences = this.selectSentences(
//         scoredSentences,
//         targetLength
//       );
      
//       // Step 4: Reconstruct summary
//       const summary = this.reconstructSummary(selectedSentences, sentences);
      
//       console.log(`✅ Summary created: ${summary.length} chars`);
//       return summary;
      
//     } catch (error) {
//       console.error('Summarization error:', error);
//       return this.fallbackSummary(text);
//     }
//   }

//   /**
//    * Extract sentences from text
//    * Handles Nigerian English patterns
//    */
//   extractSentences(text) {
//     // Handle Nigerian English: "Omo", "Abeg", "Na wa" etc.
//     const nigerianPatterns = /(?:omo|abeg|chai|na wa|ehen|okay|alright)(?:[.!?]|$)/gi;
//     const cleanedText = text.replace(nigerianPatterns, '$& ');
    
//     // Split by sentence boundaries, improved regex to handle more punctuation and abbreviations
//     const sentenceRegex = /(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?|\!|\n)\s+(?=[A-Z])/g;
//     const sentences = cleanedText.split(sentenceRegex)
//       .map(s => s.trim())
//       .filter(s => s.length > 5); // Remove very short fragments

//     return sentences;
//   }

//   /**
//    * Score sentences using multiple factors
//    */
//   scoreSentences(sentences) {
//     // Calculate word frequency across entire text
//     const allText = sentences.join(' ').toLowerCase();
//     const wordScores = this.calculateWordScores(allText);
    
//     // Score each sentence
//     return sentences.map((sentence, index) => {
//       const words = this.extractWords(sentence);
//       let score = 0;
      
//       // Factor 1: Position score (first/last are important)
//       score += this.calculatePositionScore(index, sentences.length);
      
//       // Factor 2: Word score (important words in sentence)
//       score += this.calculateWordScore(words, wordScores);
      
//       // Factor 3: Length score (prefer medium length)
//       score += this.calculateLengthScore(words.length);
      
//       // Factor 4: Question score (questions often important)
//       if (sentence.includes('?')) score += 0.3;
      
//       // Factor 5: Contains numbers/statistics
//       if (/\d+/.test(sentence)) score += 0.2;
      
//       // Factor 6: Contains emphasis words
//       score += this.calculateEmphasisScore(sentence);
      
//       // New Factor 7: Action-oriented sentence boost
//       score += this.calculateActionScore(sentence);
      
//       return {
//         sentence,
//         index,
//         score,
//         words
//       };
//     });
//   }

//   /**
//    * Calculate importance of each word
//    */
//   calculateWordScores(text) {
//     const words = this.extractWords(text);
//     const wordFrequency = {};
    
//     // Count word frequency (ignore stop words)
//     words.forEach(word => {
//       if (!this.isStopWord(word) && word.length > 2) {
//         wordFrequency[word] = (wordFrequency[word] || 0) + 1;
//       }
//     });
    
//     // Calculate scores (TF-like scoring, with log smoothing for better distribution)
//     const wordScores = {};
//     const maxFreq = Math.max(...Object.values(wordFrequency));
    
//     Object.entries(wordFrequency).forEach(([word, freq]) => {
//       // More frequent words are more important, but not too common; use log for smoothing
//       if (freq > 1) {
//         wordScores[word] = Math.log(1 + freq) / Math.log(1 + maxFreq);
//       }
//     });
    
//     return wordScores;
//   }

//   /**
//    * Position scoring: First and last sentences are important
//    */
//   calculatePositionScore(index, totalSentences) {
//     // First sentence is very important
//     if (index === 0) return 1.5;
    
//     // Last sentence is important
//     if (index === totalSentences - 1) return 1.2;
    
//     // First 20% of sentences
//     if (index < totalSentences * 0.2) return 0.8;
    
//     // Last 20% get a slight boost
//     if (index > totalSentences * 0.8) return 0.6;
    
//     // Middle sentences get base score
//     return 0.5;
//   }

//   /**
//    * Score based on important words in sentence
//    */
//   calculateWordScore(words, wordScores) {
//     let score = 0;
//     let importantWords = 0;
    
//     words.forEach(word => {
//       const lowerWord = word.toLowerCase();
//       if (wordScores[lowerWord]) {
//         score += wordScores[lowerWord];
//         importantWords++;
//       }
//     });
    
//     // Normalize by sentence length, but boost if many important words
//     if (words.length > 0) {
//       score *= (importantWords / words.length) * 1.2; // Slight boost for density
//     }
    
//     return score;
//   }

//   /**
//    * Score based on sentence length
//    * Prefer sentences of 8-20 words
//    */
//   calculateLengthScore(wordCount) {
//     if (wordCount >= 8 && wordCount <= 20) return 0.8;
//     if (wordCount >= 5 && wordCount <= 25) return 0.5;
//     if (wordCount >= 3 && wordCount <= 30) return 0.2;
//     return 0;
//   }

//   /**
//    * Score for emphasis words (common in Nigerian English)
//    */
//   calculateEmphasisScore(sentence) {
//     const emphasisWords = [
//       'important', 'critical', 'urgent', 'must', 'need', 'essential',
//       'key', 'major', 'significant', 'priority', 'action', 'decision',
//       'conclusion', 'summary', 'finally', 'therefore', 'however'
//     ];
    
//     const nigerianEmphasis = [
//       'please', 'kindly', 'abeg', 'make we', 'we need', 'we must'
//     ];
    
//     const lowerSentence = sentence.toLowerCase();
//     let score = 0;
    
//     emphasisWords.forEach(word => {
//       if (lowerSentence.includes(word)) score += 0.1;
//     });
    
//     nigerianEmphasis.forEach(word => {
//       if (lowerSentence.includes(word)) score += 0.15;
//     });
    
//     return Math.min(score, 0.5);
//   }

//   /**
//    * New: Score for action-oriented sentences
//    */
//   calculateActionScore(sentence) {
//     const actionVerbs = [
//       'create', 'build', 'design', 'write', 'send', 'email',
//       'call', 'meet', 'schedule', 'update', 'fix', 'review',
//       'prepare', 'complete', 'finish', 'submit', 'share',
//       'implement', 'deploy', 'test', 'validate', 'evaluate',
//       'report', 'notify', 'inform', 'follow up', 'assign'
//     ];
    
//     const lowerSentence = sentence.toLowerCase();
//     let score = 0;
    
//     actionVerbs.forEach(verb => {
//       if (lowerSentence.includes(verb)) score += 0.25;
//     });
    
//     // Boost if modal verbs like "should", "must"
//     if (/(should|must|need to|have to)/i.test(lowerSentence)) score += 0.3;
    
//     return Math.min(score, 0.8);
//   }

//   /**
//    * Select top sentences for summary
//    */
//   selectSentences(scoredSentences, targetLength) {
//     // Sort by score
//     const sorted = [...scoredSentences].sort((a, b) => b.score - a.score);
    
//     // Take top N, but ensure diversity (not all from beginning)
//     const selected = [];
//     const selectedIndices = new Set();
    
//     // Always include first sentence if it's good
//     const firstSentence = scoredSentences[0];
//     if (firstSentence && firstSentence.score > 0.5) {
//       selected.push(firstSentence);
//       selectedIndices.add(0);
//     }
    
//     // Select remaining sentences, preferring action-oriented ones
//     for (const sentence of sorted) {
//       if (selected.length >= targetLength) break;
      
//       // Avoid clustering (don't pick adjacent sentences unless highly scored)
//       const isTooClose = Array.from(selectedIndices).some(idx =>
//         Math.abs(idx - sentence.index) <= 1 && sentence.score < 1.0
//       );
      
//       if (!selectedIndices.has(sentence.index) && !isTooClose) {
//         selected.push(sentence);
//         selectedIndices.add(sentence.index);
//       }
//     }
    
//     // If under target, add more from sorted
//     while (selected.length < targetLength && sorted.length > 0) {
//       const next = sorted.shift();
//       if (!selectedIndices.has(next.index)) {
//         selected.push(next);
//         selectedIndices.add(next.index);
//       }
//     }
    
//     // Sort back to original order
//     return selected.sort((a, b) => a.index - b.index);
//   }

//   /**
//    * Reconstruct summary from selected sentences
//    */
//   reconstructSummary(selectedSentences, originalSentences) {
//     if (selectedSentences.length === 0) {
//       return originalSentences.slice(0, 3).join(' ');
//     }
    
//     const summary = selectedSentences
//       .map(s => s.sentence)
//       .join(' ');
    
//     // Ensure proper punctuation
//     return this.cleanSummary(summary);
//   }

//   /**
//    * Clean up summary text
//    */
//   cleanSummary(text) {
//     // Remove extra spaces
//     let cleaned = text.replace(/\s+/g, ' ');
    
//     // Ensure proper capitalization
//     cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    
//     // Ensure it ends with period
//     if (!/[.!?]$/.test(cleaned)) {
//       cleaned += '.';
//     }
    
//     return cleaned;
//   }

//   /**
//    * Fallback simple summarization
//    */
//   fallbackSummary(text) {
//     const sentences = this.extractSentences(text);
    
//     if (sentences.length <= 3) {
//       return text;
//     }
    
//     // Simple: first + middle + last
//     const first = sentences[0];
//     const middle = sentences[Math.floor(sentences.length / 2)];
//     const last = sentences[sentences.length - 1];
    
//     return `${first} ${middle} ${last}`;
//   }

//   /**
//    * Extract words from text
//    */
//   extractWords(text) {
//     return text.toLowerCase()
//       .replace(/[^\w\s]/g, ' ')
//       .split(/\s+/)
//       .filter(word => word.length > 0);
//   }

//   /**
//    * Check if word is a stop word
//    */
//   isStopWord(word) {
//     const stopWords = new Set([
//       'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
//       'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
//       'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
//       'can', 'could', 'may', 'might', 'must', 'shall', 'that', 'this', 'these',
//       'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her',
//       'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'mine', 'yours'
//     ]);
    
//     return stopWords.has(word.toLowerCase());
//   }

//   /**
//    * Extract action items from transcript
//    * Enhanced to better detect names (capitalized words) and associate actions
//    */
//   /**
//    * Extract action items from transcript
//    * Improved name + action association for voice notes
//    */
//    /**
//    * Extract action items from transcript
//    * Stronger name detection + context tracking for voice-note style assignments
//    */
//   /**
//    * Extract action items from transcript
//    * Tuned specifically for spoken assignment patterns: "Name, your job is to..." etc.
//    */
//    /**
//    * Extract action items from transcript
//    * Summarized version: one clean entry per person with main responsibility
//    */
//   extractActionItems(text) {
//     console.log('🔍 Extracting summarized action items by person...');

//     const actionItems = new Map(); // person → main summarized task string

//     // Helper to set / merge main task for a person
//     const setMainTask = (person, task) => {
//       if (!person || person === 'Team' || task.length < 20) return;
//       const cleanTask = this.formatActionItem(task)
//         .replace(/^(your job is to|you'll be handling|your focus is on|you're responsible for)\s*/i, '')
//         .replace(/^(please|kindly|abeg|also|this includes)\s*/gi, '')
//         .replace(/\s*,\s*/g, ', ')
//         .trim();

//       if (cleanTask.length < 15) return;

//       // Merge if person already has a task (combine meaningfully)
//       if (actionItems.has(person)) {
//         let existing = actionItems.get(person);
//         if (!existing.includes(cleanTask)) {
//           // Simple concatenation with "and" if it makes sense
//           actionItems.set(person, existing + ' and ' + cleanTask.replace(/^\w/, c => c.toLowerCase()));
//         }
//       } else {
//         actionItems.set(person, cleanTask);
//       }
//     };

//     // Pattern 1: Classic assignment patterns in spoken English/Nigerian style
//     const assignmentPatterns = [
//       /([A-Z][a-z]{2,}(?:\s[A-Z][a-z]{2,})?)(?:,|\.|:|\s+)\s*(your job is to|you'll be handling|your focus is on|you're responsible for|you are to|please|kindly|abeg)\s*(.+?)(?=\.|$|(?:First|Lastly|Next|And|Also)\b)/gi,
//       /([A-Z][a-z]{2,}(?:\s[A-Z][a-z]{2,})?),\s*(.+?)(?=\.|$|(?:Jordan|Sam|Taylor|Alex)\b)/gi,
//       /(First|Lastly|Next)\s*,\s*([A-Z][a-z]{2,}(?:\s[A-Z][a-z]{2,})?),\s*(.+?)(?=\.|$)/gi
//     ];

//     assignmentPatterns.forEach(regex => {
//       let match;
//       while ((match = regex.exec(text)) !== null) {
//         const person = (match[2] || match[1]).trim();
//         let task = (match[3] || match[2] || '').trim();

//         if (task) {
//           // Clean common prefixes that leak in
//           task = task.replace(/^(the back end work\.|the front end\.|testing and coordination\.)/i, '')
//                      .trim();
//           setMainTask(person, task);
//         }
//       }
//     });

//     // Pattern 2: Follow-up sentences after a person is mentioned (attach to last person)
//     let lastPerson = 'Team';
//     const sentences = this.extractSentences(text);
//     sentences.forEach(sentence => {
//       const trimmed = sentence.trim();
//       if (!trimmed) return;

//       // If sentence starts with a name → update lastPerson
//       const nameMatch = trimmed.match(/^([A-Z][a-z]{2,}(?:\s[A-Z][a-z]{2,})?)(?:,|\.|:)/);
//       if (nameMatch) {
//         lastPerson = nameMatch[1].trim();
//         let task = trimmed.slice(nameMatch[0].length).trim();
//         if (task) setMainTask(lastPerson, task);
//       }
//       // Otherwise, if it looks like continuation of a task
//       else if (lastPerson !== 'Team' && trimmed.length > 25) {
//         const lower = trimmed.toLowerCase();
//         if (lower.includes('review') || lower.includes('update') || lower.includes('implement') ||
//             lower.includes('test') || lower.includes('fix') || lower.includes('set up') ||
//             lower.includes('make sure') || lower.includes('confirm') || lower.includes('log') ||
//             lower.includes('run') || lower.includes('handle') || lower.includes('database') ||
//             lower.includes('api') || lower.includes('bugs') || lower.includes('authentication')) {
//           setMainTask(lastPerson, trimmed);
//         }
//       }
//     });

//     // Build clean summarized result
//     const result = [];
//     const orderedPersons = [...actionItems.keys()]
//       .filter(p => p !== 'Team')
//       .sort((a, b) => a.localeCompare(b));

//     orderedPersons.forEach(person => {
//       let task = actionItems.get(person);
//       // Final cleanup
//       task = task
//         .replace(/\s*\.{2,}/g, '.')
//         .replace(/\s+and\s+and\s+/gi, ' and ')
//         .trim();
//       if (task.endsWith('.')) task = task.slice(0, -1).trim();
//       result.push(`${person}: ${this.capitalizeFirst(task)}.`);
//     });

//     // Optional: add Team/general items if any significant ones remain
//     if (actionItems.has('Team')) {
//       let teamTask = actionItems.get('Team');
//       if (teamTask.length > 30) {
//         result.push(`Team: ${this.capitalizeFirst(teamTask)}.`);
//       }
//     }

//     console.log(`✅ Extracted ${result.length} summarized person-specific action items`);
//     return result;
//   }
//   /**
//    * Format action item nicely
//    */
//   formatActionItem(text) {
//     // Remove "please", "kindly" if at beginning
//     let cleaned = text
//       .replace(/^(please|kindly|abeg|beg|oya)\s+/i, '')
//       .replace(/^(i|we|you)\s(will|should|must|need to)\s/i, 'Action: ') // Prefix vague starters
//       .trim();
    
//     // Add period if missing
//     if (!/[.!?]$/.test(cleaned)) {
//       cleaned += '.';
//     }
    
//     // Capitalize first letter
//     return this.capitalizeFirst(cleaned);
//   }

//   /**
//    * Capitalize first letter
//    */
//   capitalizeFirst(text) {
//     return text.charAt(0).toUpperCase() + text.slice(1);
//   }
// }
// // Create singleton instance
// module.exports = new Summarizer();