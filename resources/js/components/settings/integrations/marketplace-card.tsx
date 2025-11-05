import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardContent,
    CardDescription,
    CardTitle,
} from '@/components/ui/card';
import { AlertTriangle, ChevronRight } from 'lucide-react';

export interface MarketplaceCardProps {
    name: string;
    logo: string;
    description: string;
    available: boolean;
    onClick?: () => void;
    showAlert?: boolean;
}

export function MarketplaceCard({
    name,
    logo,
    description,
    available,
    onClick,
    showAlert = false,
}: MarketplaceCardProps) {
    return (
        <Card
            onClick={available ? onClick : undefined}
            className={`flex items-center justify-between px-6 py-4 shadow-none transition duration-100 ease-in-out ${
                available
                    ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900'
                    : 'cursor-not-allowed opacity-70'
            }`}
        >
            <CardContent className="flex h-full w-full flex-row items-center justify-between p-0">
                <div className="flex items-center gap-4">
                    <img
                        src={logo}
                        alt={name}
                        className="h-10 w-10 rounded-lg object-contain xl:h-14 xl:w-14"
                    />
                    <div className="flex flex-col items-start justify-center">
                        <CardTitle className="text-sm font-semibold xl:text-base">
                            {name}
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground xl:text-sm">
                            {description}
                        </CardDescription>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {showAlert && (
                        <AlertTriangle className="text-red-500" size={20} />
                    )}
                    {!available && (
                        <Badge variant="secondary" className="ml-2">
                            Em breve
                        </Badge>
                    )}
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
            </CardContent>
        </Card>
    );
}
