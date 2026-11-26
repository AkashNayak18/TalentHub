import { OfferService } from '../services/offer-service.js';
import { OfferCreate, offerOut } from '../schemas.js';
import { COMPANY, STUDENT } from './auth.js';

export function offerRoutes(router) {
  router.add('POST', '/applications/:application_id:int/offer',
    { auth: COMPANY, body: OfferCreate, optionalBody: true, status: 201 },
    ({ db, company, params, body }) => offerOut(new OfferService(db).issue(company, params.application_id, body)));

  router.add('GET', '/offers/me', { auth: STUDENT },
    ({ db, student }) => new OfferService(db).listForStudent(student).map(offerOut));

  router.add('POST', '/offers/:offer_id:int/accept', { auth: STUDENT },
    ({ db, student, params }) => offerOut(new OfferService(db).accept(student, params.offer_id)));

  router.add('POST', '/offers/:offer_id:int/decline', { auth: STUDENT },
    ({ db, student, params }) => offerOut(new OfferService(db).decline(student, params.offer_id)));
}
