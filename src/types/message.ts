import { AppRouter } from '@/trpc';
import { inferRouterOutputs } from '@trpc/server';

type RouterOutput = inferRouterOutputs<AppRouter>;

type Messages = RouterOutput['getFileMessages']['messages'];

export type ExtendedMessage = Omit<Messages[number], 'text'> & {
	text: string | JSX.Element;
};
