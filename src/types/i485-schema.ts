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

export interface I485ExtractedData {
    documentType: string;
    confidence: 'high' | 'medium' | 'low';
    extractedAt?: string;
    applicant?: {
        firstName?: string;
        middleName?: string;
        lastName?: string;
        fullName?: string;
        dateOfBirth?: string;
        placeOfBirth?: string;
        cityOfBirth?: string;
        countryOfBirth?: string;
        sex?: 'M' | 'F';
        nationality?: string;
    };
    passport?: {
        passportNumber?: string;
        issueDate?: string;
        expirationDate?: string;
        issuingCountry?: string;
        issuingAuthority?: string;
        mrzLine1?: string;
        mrzLine2?: string;
    };
    visa?: {
        visaType?: string;
        visaNumber?: string;
        issueDate?: string;
        expirationDate?: string;
        issuingPost?: string;
        entries?: 'M' | 'S';
        annotations?: string;
    };
    i94?: {
        i94Number?: string;
        arrivalDate?: string;
        admittedUntil?: string;
        admittedAs?: string;
        portOfEntry?: string;
        travelDocument?: string;
    };
    i797_i140?: {
        receiptNumber?: string;
        noticeDate?: string;
        approvalDate?: string;
        petitionerName?: string;
        beneficiaryName?: string;
        employmentCategory?: string;
        priorityDate?: string;
        classPreferenceCode?: string;
        alienNumber?: string;
    };
    civilCertificate?: {
        documentType?: 'birth' | 'marriage' | 'divorce' | 'death';
        registryNumber?: string;
        registryDate?: string;
        registryCity?: string;
        registryState?: string;
        registryCountry?: string;
        hasTranslation?: boolean;
        subjectName?: string;
        subjectDateOfBirth?: string;
        fatherName?: string;
        motherName?: string;
        spouse1Name?: string;
        spouse2Name?: string;
        marriageDate?: string;
        marriageCity?: string;
        marriageState?: string;
        separationDate?: string;
        divorceDate?: string;
        divorceCity?: string;
    };
    medicalExam?: {
        physicianName?: string;
        clinicName?: string;
        clinicAddress?: string;
        examDate?: string;
        receiptNumber?: string;
        beneficiaryName?: string;
        estimatedExpiry?: string;
    };
    paymentReceipt?: {
        receiptNumber?: string;
        feeType?: 'I-485' | 'biometrics' | 'other';
        caseType?: string;
        amount?: string;
        paymentDate?: string;
        applicantName?: string;
        receivedDate?: string;
    };
    formAutoFill?: Record<string, string>;
    warnings?: string[];
    missingFields?: string[];
    rawText?: string;
}
