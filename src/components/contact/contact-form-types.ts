export interface ContactFormProps {
  className?: string;
}

export interface FormErrors {
  name?: string;
  phone?: string;
  content?: string;
}

export const PHONE_REGEX = /^0\d{8,10}$/;
