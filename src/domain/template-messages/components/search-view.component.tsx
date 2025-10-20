import { useState } from "react";
import { TemplateGroup } from "../template-messages.types";
import ItemCard from "./item-card.component";
import { Input } from "../../../components/ui/input";
import { Search } from "lucide-react";

interface SearchViewProps {
    templates: TemplateGroup[];
}

const SearchView: React.FC<SearchViewProps> = ({ templates }) => {
    const [searchQuery, setSearchQuery] = useState("");

    const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(event.target.value.toLowerCase());
    };

    const filteredTemplates = templates.filter(group =>
        group.group.toLowerCase().includes(searchQuery) ||
        group.items.some(item =>
            item.title.toLowerCase().includes(searchQuery) ||
            item.content.toLowerCase().includes(searchQuery)
        )
    );


    return (
        <div className="px-1">
            <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={handleSearch}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pl-8 mb-4"
                />
            </div>
            {searchQuery.length > 0 && filteredTemplates.length > 0 ? (
                filteredTemplates.map((group: TemplateGroup, groupIndex: number) => (
                    <div key={groupIndex}>
                        <ul className="flex flex-col gap-2">
                            {group.items.map((item, itemIndex) => (
                                <li key={itemIndex}>
                                    <ItemCard item={item} itemIndex={itemIndex} />
                                </li>
                            ))}
                        </ul>
                    </div>
                ))
            ) : (
                <p className="text-sm text-muted-foreground">No results found.</p>
            )}
        </div>
    );
};

export default SearchView;
