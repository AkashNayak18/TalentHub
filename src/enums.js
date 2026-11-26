const make = (...values) => Object.freeze(Object.fromEntries(values.map((v) => [v, v])));

export const Role = make('STUDENT', 'COMPANY', 'COORDINATOR');
export const ApplicationStatus = make(
  'APPLIED', 'SHORTLISTED', 'REJECTED', 'INTERVIEW_SCHEDULED', 'SELECTED', 'NOT_SELECTED',
  'OFFERED', 'OFFER_ACCEPTED', 'OFFER_DECLINED', 'OFFER_WITHDRAWN',
);
export const InterviewMode = make('ONLINE', 'ONSITE');
export const InterviewResult = make('PENDING', 'PASSED', 'FAILED');
export const OfferStatus = make('ISSUED', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');
