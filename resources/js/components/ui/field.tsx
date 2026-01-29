import * as React from 'react';
import { cn } from '@/lib/utils';

const Field = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & {
        orientation?: 'horizontal' | 'vertical';
    }
>(({ className, orientation = 'vertical', ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            'flex gap-3 rounded-lg border p-4 transition-colors hover:bg-accent',
            orientation === 'horizontal'
                ? 'flex-row items-center justify-between'
                : 'flex-col',
            className,
        )}
        {...props}
    />
));
Field.displayName = 'Field';

const FieldContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-1', className)} {...props} />
));
FieldContent.displayName = 'FieldContent';

const FieldTitle = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn('font-semibold leading-none', className)}
        {...props}
    />
));
FieldTitle.displayName = 'FieldTitle';

const FieldDescription = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
    <p
        ref={ref}
        className={cn('text-sm text-muted-foreground', className)}
        {...props}
    />
));
FieldDescription.displayName = 'FieldDescription';

const FieldLabel = React.forwardRef<
    HTMLLabelElement,
    React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
    <label
        ref={ref}
        className={cn('cursor-pointer', className)}
        {...props}
    />
));
FieldLabel.displayName = 'FieldLabel';

export { Field, FieldContent, FieldTitle, FieldDescription, FieldLabel };
