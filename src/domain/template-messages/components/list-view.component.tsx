import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../../components/ui/accordion";

import { TemplateGroup } from "../template-messages.types";
import ItemCard from "./item-card.component";

interface ListViewProps {
    templates: TemplateGroup[];

}

const ListView: React.FC<ListViewProps> = ({ templates }) => {

    return (
        <>
            {templates.map((group: TemplateGroup, groupIndex: number) => (
                <Accordion key={groupIndex} type="single" collapsible className="w-full">
                    <AccordionItem value={String(groupIndex)}>
                        <AccordionTrigger>
                            <span className="uppercase text-[11px] tracking-wider">{group.group}</span>
                        </AccordionTrigger>
                        <AccordionContent>

                            <ul className="flex flex-col gap-2 h-[350px] overflow-y-scroll"

                            >
                                {group.items.map((item, itemIndex) => (
                                    <li key={itemIndex}>
                                        <ItemCard item={item} itemIndex={itemIndex} />
                                    </li>
                                ))}
                            </ul>

                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            ))}
        </>

    );
};

export default ListView;
