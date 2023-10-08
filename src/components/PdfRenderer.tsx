'use client';
import {
	ChevronDown,
	ChevronUp,
	Loader2,
	RotateCw,
	Search,
} from 'lucide-react';
import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { useToast } from './ui/use-toast';
import { useResizeDetector } from 'react-resize-detector';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from './ui/dropdown-menu';
import SimpleBar from 'simplebar-react';
import PdfFullScreen from './PdfFullScreen';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;

type PdfRendererProps = {
	url: string;
};

const PdfRenderer = ({ url }: PdfRendererProps) => {
	const { toast } = useToast();

	const [numPages, setNumPages] = useState<number>();
	const [currPage, setCurrPage] = useState<number>(1);
	const [scale, setScale] = useState<number>(1);
	const [rotation, setRotation] = useState<number>(0);
	const [renderedScale, setRenderedScale] = useState<number | null>(null);

	const isLoading = renderedScale !== scale;

	const CustomPageValidator = z.object({
		page: z
			.string()
			.refine((num) => Number(num) > 0 && Number(num) <= numPages!),
	});

	type TCustomPageValidator = z.infer<typeof CustomPageValidator>;

	const {
		register,
		handleSubmit,
		formState: { errors },
		setValue,
	} = useForm<TCustomPageValidator>({
		resolver: zodResolver(CustomPageValidator),
		defaultValues: {
			page: '1',
		},
	});

	const handlePageSubmit = ({ page }: TCustomPageValidator) => {
		setCurrPage(Number(page));
		setValue('page', String(page));
	};

	const { width, ref } = useResizeDetector();

	return (
		<div className='w-full bg-white rounded-md shadow flex flex-col items-center'>
			<div className='h-14 w-full border-b border-zinc-200 flex items-center justify-between px-2'>
				<div className='flex items-center gap-1.5'>
					<Button
						aria-label='previous page'
						variant='ghost'
						disabled={currPage <= 1}
						onClick={() => {
							setCurrPage((prev) => (prev - 1 > 1 ? prev - 1 : 1));
							setValue('page', String(currPage - 1));
						}}
					>
						<ChevronDown className='h-4 w-4' />
					</Button>

					<div className='flex items-center gap-1.5'>
						<Input
							{...register('page')}
							onKeyDown={(e) => {
								if (e.key === 'Enter') {
									handleSubmit(handlePageSubmit)();
								}
							}}
							className={cn(
								'w-12 h-8',
								errors.page && 'focus-visible:ring-red-500'
							)}
						/>
						<p className='text-zinc-700 text-sm space-x-1'>
							<span>/</span>
							<span>{numPages ?? 'x'}</span>
						</p>
					</div>

					<Button
						disabled={numPages === undefined || numPages === currPage}
						aria-label='next page'
						variant='ghost'
						onClick={() => {
							setCurrPage((prev) =>
								prev + 1 > numPages! ? numPages! : prev + 1
							);
							setValue('page', String(currPage + 1));
						}}
					>
						<ChevronUp className='h-4 w-4' />
					</Button>
				</div>

				<div className='space-x-2'>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant='ghost' aria-label='zoom' className='gap-1.5'>
								<Search className='h-4 w-w' />
								{scale * 100}%<ChevronDown className='w-3 h-3 opacity-50' />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							<DropdownMenuItem onSelect={() => setScale(1)}>
								100%
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={() => setScale(1.5)}>
								150%
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={() => setScale(2)}>
								200%
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={() => setScale(2.5)}>
								250%
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>

					<Button
						aria-label='rotate 90 degrees'
						variant='ghost'
						onClick={() => setRotation((prev) => prev + 90)}
					>
						<RotateCw className='h-4 w-4' />
					</Button>

					<PdfFullScreen fileUrl={url} />
				</div>
			</div>

			<div className='flex-1 w-full max-h-screen'>
				<SimpleBar autoHide={false} className='max-h-[calc(100vh-10rem)]'>
					<div ref={ref}>
						<Document
							className='max-h-full'
							file={url}
							loading={
								<div className='flex justify-center'>
									<Loader2 className='my-24 h-6 w-6 animate-spin' />
								</div>
							}
							onLoadError={() => {
								toast({
									title: 'Error loading PDF',
									description: 'Please try again later',
									variant: 'destructive',
								});
							}}
							onLoadSuccess={({ numPages }) => setNumPages(numPages)}
						>
							{isLoading && renderedScale ? (
								<Page
									width={width ? width : 1}
									pageNumber={currPage}
									scale={scale}
									key={'@' + renderedScale}
									rotate={rotation}
								/>
							) : null}

							<Page
								width={width ? width : 1}
								pageNumber={currPage}
								scale={scale}
								rotate={rotation}
								key={'@' + scale}
								loading={
									<div className='flex justify-center'>
										<Loader2 className='my-24 h-6 w-6 animate-spin' />
									</div>
								}
								onRenderSuccess={() => setRenderedScale(scale)}
								className={cn(isLoading ? 'hidden' : '')}
							/>
						</Document>
					</div>
				</SimpleBar>
			</div>
		</div>
	);
};

export default PdfRenderer;
