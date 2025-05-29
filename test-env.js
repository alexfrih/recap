// Test environment variable loading
console.log('Environment variables:');
console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
console.log('OPENAI_API_KEY length:', process.env.OPENAI_API_KEY?.length);
console.log('OPENAI_API_KEY starts with:', process.env.OPENAI_API_KEY?.substring(0, 10));

// Check if it has the duplicate prefix issue
if (process.env.OPENAI_API_KEY?.startsWith('OPENAI_API_KEY=')) {
	console.log('❌ DUPLICATE PREFIX DETECTED!');
	console.log('Raw value:', process.env.OPENAI_API_KEY);
} else if (process.env.OPENAI_API_KEY?.startsWith('sk-')) {
	console.log('✅ API key looks correct');
} else {
	console.log('❓ Unexpected format or missing');
} 