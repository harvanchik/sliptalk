import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface PhraseDifficulty {
	level: 1 | 2 | 3;
	description: string;
	wordCount: string;
	examples: string[];
}

// Enhanced difficulty definitions with specific word count requirements
const difficulties: Record<number, PhraseDifficulty> = {
	1: {
		level: 1,
		description:
			'a slightly unusual but very natural phrase that could easily be slipped into casual conversation',
		wordCount: '5-10 words',
		examples: [
			'I dreamt about singing in the rain yesterday',
			'My coffee tastes like burnt sunshine today',
			'This chair remembers me from last time',
			'Dino nuggets are good, but have you tried them frozen?'
		]
	},
	2: {
		level: 2,
		description:
			'a weird and unusual phrase that would be challenging but possible to use in normal conversation',
		wordCount: '7-14 words',
		examples: [
			'Sometimes I wake up speaking fluent dolphin',
			'My shadow and I had a disagreement yesterday',
			'The butter in my fridge tastes milk-flavored antifreeze',
			'I lost my train of thought... What was it?  Oh right! Trains!'
		]
	},
	3: {
		level: 3,
		description:
			'a borderline bizarre or edgy phrase that would be very difficult to slip into conversation (but still safe for work)',
		wordCount: '10-18 words',
		examples: [
			'I was banned from the post office for licking too many stamps',
			'My therapist says my relationship with cheese is problematic',
			'I can taste the color purple, but only on Tuesdays',
			'When in doubt, you can always rely on my Uncle Ron to ruin your birthday party'
		]
	}
};

// Track previously generated phrases to avoid repetition
let previouslyGeneratedPhrases = new Set<string>();

// Function to periodically reset the stored phrases (every ~100 phrases)
// to prevent the set from growing too large over time
function manageStoredPhrases(newPhrases: string[]) {
	// Add new phrases to the set
	newPhrases.forEach((phrase) => previouslyGeneratedPhrases.add(phrase));

	// If we have accumulated too many phrases, reset the collection
	// but keep the latest batch
	if (previouslyGeneratedPhrases.size > 100) {
		previouslyGeneratedPhrases = new Set(newPhrases);
	}
}

export interface Phrase {
	text: string;
	points: number;
}

// Fallback phrases if API call fails
function fallbackPhrases(errorMessage?: string): Phrase[] {
	return [
		{ text: errorMessage || 'I always forget about my elbows', points: 1 },
		{ text: 'You ever think pigeons are spies?', points: 2 },
		{ text: 'They banned me from the aquarium for tickling the stingrays', points: 3 }
	];
}

export const POST: RequestHandler = async () => {
	try {
		const apiKey = env.GEMINI_API_KEY;
		if (!apiKey) {
			console.error(
				'Error: GEMINI_API_KEY not found in environment variables. Please add this variable to your Vercel project settings.'
			);
			return json(fallbackPhrases('Error: API key missing. Contact the admin.'), {
				status: 500,
				headers: {
					'Cache-Control': 'no-store'
				}
			});
		}

		// Enhanced prompt with more specific instructions for diversity and word count requirements
		const prompt = `
		Generate exactly 3 creative, unique phrases or questions that would be challenging to naturally slip into a conversation.
		Each phrase should be at a different difficulty level as described below.
		
		Difficulty levels:
		1. ${difficulties[1].description} (${difficulties[1].wordCount})
		2. ${difficulties[2].description} (${difficulties[2].wordCount})
		3. ${difficulties[3].description} (${difficulties[3].wordCount})
		
		IMPORTANT: Generate phrases that are completely DIFFERENT from these previously used phrases (DO NOT use any of these):
		${Array.from(previouslyGeneratedPhrases).slice(0, 15).join(', ')}
		
		Examples of good phrases for each level (for inspiration only, don't copy these):
		
		Level 1 examples:
		- ${difficulties[1].examples.join('\n- ')}
		
		Level 2 examples:
		- ${difficulties[2].examples.join('\n- ')}
		
		Level 3 examples:
		- ${difficulties[3].examples.join('\n- ')}
		
		CRITICAL - AVOID OVERUSED TOPICS: The AI has been overusing certain topics:
		- Elevators, escalators or stairs
		- Shoes, socks, or footwear
		- Fortune cookies or any fortune-telling items
		- Office supplies (staplers, paper clips, etc.)
		- Dental topics (dentists, flossing, teeth)
		- Accents or speech patterns
		- Pigeons, seagulls, or common urban birds
		- Common food items (cookies, coffee, salads)
		- Sleep habits or dreams
		- Common body parts (elbows, knees, fingers)
        - Houseplants
        - My "aura"
		
		Explore diverse and unexpected domains like:
		- Obscure historical events or historical figures
		- Unusual natural phenomena
		- Niche hobbies or activities
		- Abstract concepts and philosophical ideas
		- Uncommon animals or plants
		- Specialized professions
		- Unusual sensory experiences
		- Mythological references
		- Scientific curiosities
		- Cultural practices from around the world
        - Crazy new specific health trends
		
		Guidelines for all phrases:
		- STRICTLY follow the word count requirements for each level
		- Ensure MAXIMUM VARIETY and DIVERSITY in themes, subjects, and vocabulary
        - No fairytale-like or unrealistic scenarios
		- No repeated structures across the three phrases
		- Avoid using the same nouns, verbs or sentence patterns between phrases
		- Each phrase should explore completely different domains or fields
        - Be specific instead of using generic terms (e.g., viper instead of snake)
		- Keep all content safe for work but creative
		- Make each phrase memorable and distinct in style
		- Ensure they're pronounceable and could conceivably be used in speech
        - Respect religious and cultural sensitivities
        - Prioritize originality over everything else
        - Do NOT use phallic references, puns, or innuendoes
        - Do NOT use innuendoes or sexual references
        - Do NOT use profanity or explicit language
        - Do NOT use inappropriate body part references (i.e, penis, vagina, etc.)
		
		Format your response as a JSON array of objects with 'text' and 'points' properties exactly like this:
		[
			{"text": "phrase 1 here", "points": 1},
			{"text": "phrase 2 here", "points": 2},
			{"text": "phrase 3 here", "points": 3}
		]
    `;

		try {
			const response = await fetch(
				`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						contents: [
							{
								parts: [
									{
										text: prompt
									}
								]
							}
						],
						// Add temperature and top_p settings to increase creativity
						generationConfig: {
							temperature: 0.9,
							topP: 0.95,
							topK: 40
						}
					})
				}
			);

			if (!response.ok) {
				const errorData = await response.text();
				console.error(`Gemini API error (${response.status}):`, errorData);

				// Handle rate limit errors specifically
				if (response.status === 429) {
					return json(
						fallbackPhrases('Rate limit exceeded. Please wait a moment before trying again.'),
						{
							status: 429,
							headers: {
								'Cache-Control': 'no-store',
								'Retry-After': response.headers.get('Retry-After') || '60'
							}
						}
					);
				}

				throw new Error(`API error: ${response.status}`);
			}

			const data = await response.json();

			// Extract the text from the response
			const text = data.candidates[0].content.parts[0].text;

			// Parse the JSON from the response text
			// The text might contain markdown formatting, so we need to extract just the JSON part
			const jsonMatch = text.match(/\[\s*\{.*\}\s*\]/s);
			if (!jsonMatch) {
				throw new Error('Failed to extract JSON from response');
			}

			const jsonText = jsonMatch[0];
			const phrases: Phrase[] = JSON.parse(jsonText);

			// Validate the phrases
			if (!Array.isArray(phrases) || phrases.length !== 3) {
				throw new Error('Invalid format: Expected an array of 3 phrases');
			}

			// Update our tracking of previously generated phrases
			manageStoredPhrases(phrases.map((p) => p.text));

			return json(
				phrases.map((phrase, index) => ({
					text: phrase.text,
					points: index + 1 // Ensure points are 1, 2, 3
				}))
			);
		} catch (fetchError) {
			console.error('Error fetching from Gemini API:', fetchError);
			return json(fallbackPhrases(), {
				status: 503,
				headers: {
					'Cache-Control': 'no-store'
				}
			});
		}
	} catch (error) {
		console.error('Error generating phrases with Gemini:', error);
		return json(fallbackPhrases(), {
			status: 500,
			headers: {
				'Cache-Control': 'no-store'
			}
		});
	}
};
