import { db } from '@/db';
import { getPineconeClient } from '@/lib/pinecone';
import { replicate } from '@/lib/replicate';
import { SendMessageValidator } from '@/lib/validators/SendMessageValidator';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { CohereEmbeddings } from 'langchain/embeddings/cohere';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { NextRequest } from 'next/server';
import { experimental_buildLlama2Prompt } from 'ai/prompts';
import { ReplicateStream, StreamingTextResponse } from 'ai';

export const POST = async (req: NextRequest) => {
	const body = await req.json();

	const { getUser } = getKindeServerSession();
	const user = getUser();

	const { id: userId } = user;

	if (!user) return new Response('Unauthorized', { status: 401 });

	const { fileId, message } = SendMessageValidator.parse(body);

	const file = await db.file.findFirst({
		where: {
			id: fileId,
			userId,
		},
	});

	if (!file) return new Response('Not found', { status: 404 });

	await db.message.create({
		data: {
			text: message,
			isUserMessage: true,
			userId,
			fileId,
		},
	});

	const embeddings = new CohereEmbeddings({
		apiKey: process.env.COHERE_API_KEY!,
	});

	const pinecone = await getPineconeClient();
	const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX!);

	const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
		pineconeIndex,
		namespace: file.id,
	});

	const results = await vectorStore.similaritySearch(message, 2);

	const prevMessages = await db.message.findMany({
		where: {
			fileId,
			userId,
		},
		orderBy: {
			createdAt: 'asc',
		},
		take: 6,
	});

	// how do the messages need to be transformed for llama 2?
	const formattedPrevMessages = prevMessages.map((msg) => ({
		role: msg.isUserMessage ? ('user' as const) : ('assistant' as const),
		content: msg.text,
	}));

	const response = await replicate.predictions.create({
		stream: true,
		version: 'f4e2de70d66816a838a89eeeb621910adffb0dd0baba3976c96980970978018d',
		input: {
			prompt: experimental_buildLlama2Prompt([
				{
					role: 'system',
					content:
						'Use the following pieces of context (or previous conversaton if needed) to answer the users question in markdown format.',
				},
				{
					role: 'user',
					content: `Use the following pieces of context (or previous conversaton if needed) to answer the users question in markdown format. ONLY generate plain sentences without prefix of who is speaking. \nIf you don't know the answer, just say that you don't know, don't try to make up an answer.
					
					\n----------------\n
		
					PREVIOUS CONVERSATION:
					${formattedPrevMessages.map((message) => {
						if (message.role === 'user') return `User: ${message.content}\n`;
						return `Assistant: ${message.content}\n`;
					})}
					
					\n----------------\n
					
					CONTEXT:
					${results.map((r) => r.pageContent).join('\n\n')}
					
					USER INPUT: ${message}`,
				},
			]),
		},
	});

	// @ts-ignore
	const stream = await ReplicateStream(response, {
		async onCompletion(completion) {
			await db.message.create({
				data: {
					text: completion,
					isUserMessage: false,
					fileId,
					userId,
				},
			});
		},
	});

	return new StreamingTextResponse(stream);
};
