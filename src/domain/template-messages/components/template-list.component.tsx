import { useEffect, useState } from "react";
import templateMessagesEntity from "../template-messages.entity";
import { TemplateGroup } from "../template-messages.types";
import ListView from "./list-view.component";
import SearchView from "./search-view.component";
import Tabs from "./tabs.component";


export default function TemplateList() {
    const [templates, setTemplates] = useState<TemplateGroup[]>([]);
    const [activeTab, setActiveTab] = useState("list");

    useEffect(() => {
        templateMessagesEntity.getMessages().then(setTemplates);
    }, []);


    return (
        <div className="mt-4">
            <Tabs activeTab={activeTab} setActiveTab={setActiveTab} />
            {activeTab === "list" && (
                <ListView
                    templates={templates}

                />
            )}
            {activeTab === "search" && (
                <SearchView
                    templates={templates}

                />
            )}
        </div>
    );
}
