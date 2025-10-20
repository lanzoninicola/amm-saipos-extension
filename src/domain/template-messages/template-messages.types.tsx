export interface TemplateItem {
    title: string;
    content: string;
}

export interface TemplateGroup {
    group: string;
    items: TemplateItem[];
}
