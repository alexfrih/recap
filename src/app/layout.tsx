import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "YouTube Video Recap",
	description: "Transform any YouTube video into a concise, AI-powered summary using OpenAI's Whisper and GPT models.",
	keywords: ["YouTube", "video", "summary", "AI", "transcription", "OpenAI", "Whisper"],
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body className="antialiased">
				{children}
			</body>
		</html>
	);
}
