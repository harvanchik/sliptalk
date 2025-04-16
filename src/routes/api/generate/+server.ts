import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface PhraseDifficulty {
	level: 1 | 2 | 3;
	description: string;
}

const difficulties: Record<number, PhraseDifficulty> = {
	1: {
		level: 1,
		description:
			'a mildly unusual but casual phrase that could be naturally slipped into conversation'
	},
	2: {
		level: 2,
		description:
			'a weird and unusual phrase that would be challenging but possible to use in normal conversation'
	},
	3: {
		level: 3,
		description:
			'a borderline bizarre or edgy phrase that would be very difficult to slip into conversation (but still safe for work)'
	}
};

export interface Phrase {
	text: string;
	points: number;
}

// Fallback phrases if API call fails
function fallbackPhrases(): Phrase[] {
	return [
		{ text: 'I always forget about my elbows', points: 1 },
		{ text: 'You ever think pigeons are spies?', points: 2 },
		{ text: 'They banned me from the aquarium for tickling the stingrays', points: 3 }
	];
}

export const POST: RequestHandler = async () => {
	try {
		const apiKey = env.GEMINI_API_KEY;
		if (!apiKey) {
			console.error('Gemini API key not found');
			return json(fallbackPhrases());
		}

		// We'll generate all three phrases in a single request for efficiency
		const prompt = `
      Generate exactly 3 phrases that would be challenging to naturally slip into a conversation.
      Each phrase should be at a different difficulty level:
      
      1. ${difficulties[1].description}
      2. ${difficulties[2].description}
      3. ${difficulties[3].description}
      
      For each phrase:
      - Ensure they are original, unique, creative, and not commonly used
      - Keep them safe for work
      - Make them memorable and distinct
      - Avoid phrases that are impossible to use in conversation
      - Be respectful of religious or cultural sensitivities (i.e., no using the Lord's name in vain)
      - Don't include explanations, just return the three phrases in the exact format specified below
      
      Format your response as a JSON array of objects with 'text' and 'points' properties like this:
      [
        {"text": "phrase 1 here", "points": 1},
        {"text": "phrase 2 here", "points": 2},
        {"text": "phrase 3 here", "points": 3}
      ]
    `;

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
					]
				})
			}
		);

		if (!response.ok) {
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

		return json(
			phrases.map((phrase, index) => ({
				text: phrase.text,
				points: index + 1 // Ensure points are 1, 2, 3
			}))
		);
	} catch (error) {
		console.error('Error generating phrases with Gemini:', error);
		return json(fallbackPhrases());
	}
};
