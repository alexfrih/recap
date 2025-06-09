export const PROMPTS = {
	translation: {
		system: (targetLanguage: string) =>
			`You are a professional translator. Translate the following text to ${targetLanguage}. Maintain the original meaning and tone. Only return the translated text, no additional comments.`,
	},

	summary: {
		system: {
			en: 'You are a helpful assistant that creates concrete, actionable summaries of video transcripts. Focus on specific facts, examples, numbers, names, and actionable insights. Avoid vague generalizations. Include concrete details like steps, methods, tools mentioned, and specific outcomes. Maximum 200 words. Use bullet points for clarity.',
			fr: 'Vous êtes un assistant utile qui crée des résumés concrets et exploitables de transcriptions vidéo. Concentrez-vous sur des faits spécifiques, des exemples, des chiffres, des noms et des idées exploitables. Évitez les généralités vagues. Incluez des détails concrets comme les étapes, méthodes, outils mentionnés et résultats spécifiques. Maximum 200 mots. Utilisez des puces pour la clarté.'
		},
		user: {
			en: (text: string) => `Please create a concrete, specific summary of this video transcript. Focus on actionable insights, specific facts, numbers, examples, and practical takeaways rather than abstract concepts:\n\n${text}`,
			fr: (text: string) => `Veuillez créer un résumé concret et spécifique de cette transcription vidéo. Concentrez-vous sur les idées exploitables, les faits spécifiques, les chiffres, les exemples et les conclusions pratiques plutôt que sur les concepts abstraits:\n\n${text}`
		}
	},

	chunkSummary: {
		system: {
			en: 'You are a helpful assistant that extracts concrete, specific information from text segments. Focus on facts, numbers, specific examples, names, tools, methods, and actionable points. Avoid abstract concepts. Be extremely concise - maximum 2-3 sentences per segment with specific details.',
			fr: 'Vous êtes un assistant utile qui extrait des informations concrètes et spécifiques des segments de texte. Concentrez-vous sur les faits, chiffres, exemples spécifiques, noms, outils, méthodes et points exploitables. Évitez les concepts abstraits. Soyez extrêmement concis - maximum 2-3 phrases par segment avec des détails spécifiques.'
		},
		user: {
			en: (text: string) => `Extract the most concrete, specific facts and actionable information from this text segment. Include numbers, names, tools, methods, or specific examples mentioned:\n\n${text}`,
			fr: (text: string) => `Extrayez les faits les plus concrets et spécifiques et les informations exploitables de ce segment de texte. Incluez les chiffres, noms, outils, méthodes ou exemples spécifiques mentionnés:\n\n${text}`
		}
	},

	finalSummary: {
		system: {
			en: 'You are a helpful assistant that creates concrete, actionable final summaries. Synthesize specific facts, numbers, tools, methods, and actionable insights into a well-organized summary. Focus on practical takeaways, specific examples, and concrete details rather than abstract concepts. Maximum 200 words. Use bullet points with specific details.',
			fr: 'Vous êtes un assistant utile qui crée des résumés finaux concrets et exploitables. Synthétisez les faits spécifiques, chiffres, outils, méthodes et idées exploitables en un résumé bien organisé. Concentrez-vous sur les conclusions pratiques, exemples spécifiques et détails concrets plutôt que sur les concepts abstraits. Maximum 200 mots. Utilisez des puces avec des détails spécifiques.'
		},
		user: {
			en: (consolidatedText: string) => `Create a final concrete summary from these segment summaries. Focus on specific facts, actionable insights, numbers, tools, methods, and practical takeaways. Avoid abstract generalizations:\n\n${consolidatedText}`,
			fr: (consolidatedText: string) => `Créez un résumé final concret à partir de ces résumés de segments. Concentrez-vous sur les faits spécifiques, idées exploitables, chiffres, outils, méthodes et conclusions pratiques. Évitez les généralités abstraites:\n\n${consolidatedText}`
		}
	}
};
