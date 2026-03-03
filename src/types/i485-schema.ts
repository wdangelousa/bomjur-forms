export type DocumentCategory = 'personal' | 'legal' | 'process' | 'financial';

export interface DocumentRequirement {
    id: string;
    label: string;
    description?: string;
    category: DocumentCategory;
    required: boolean;
    multiple?: boolean;
    // A condição determina se o documento deve aparecer na tela
    condition?: (answers: ScreeningAnswers) => boolean;
    isProexpandInternal?: boolean; // Se true, marca visualmente como documento administrativo
}

export interface ScreeningAnswers {
    isMarried: boolean;
    hasChildren: boolean;
    hasPriorMarriages: boolean;
    hasCriminalRecord: boolean;
}
