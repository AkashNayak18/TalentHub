import { ApplicationStatus, OfferStatus } from '../enums.js';
import { BusinessRuleError, ForbiddenError, NotFoundError } from '../errors.js';
import { ApplicationRepository } from '../repositories/application-repository.js';
import { StudentRepository } from '../repositories/student-repository.js';
import { utcnow } from '../utils.js';
import { getCompanyApplication } from './access.js';

export class OfferService {
  constructor(db) {
    this.db = db;
    this.applications = new ApplicationRepository(db);
    this.students = new StudentRepository(db);
  }

  issue(company, applicationId, data) {
    const application = getCompanyApplication(this.applications, company, applicationId);
    if (application.status !== ApplicationStatus.SELECTED) {
      throw new BusinessRuleError(
        `Offers can only be issued to students who cleared the interview (current status: ${application.status})`);
    }
    if (application.student.is_placed) throw new BusinessRuleError('This student has already accepted another offer');

    const package_lpa = data.package_lpa ?? application.job.package_lpa;
    return this.db.transaction(() => {
      const offer = this.applications.addOffer({ application_id: application.id, package_lpa });
      this.applications.setStatus(application.id, ApplicationStatus.OFFERED);
      return offer;
    });
  }

  listForStudent(student) { return this.applications.listOffersForStudent(student.id); }

  accept(student, offerId) {
    const offer = this.#getPendingOffer(student, offerId);
    if (student.is_placed) throw new BusinessRuleError('You have already accepted another offer');

    return this.db.transaction(() => {
      const accepted = this.applications.setOfferStatus(offer.id, OfferStatus.ACCEPTED, utcnow());
      this.applications.setStatus(offer.application_id, ApplicationStatus.OFFER_ACCEPTED);
      this.students.setPlaced(student.id, true);

      // One student, one placement: withdraw every other outstanding offer.
      for (const other of this.applications.listOffersForStudent(student.id)) {
        if (other.id !== offer.id && other.status === OfferStatus.ISSUED) {
          this.applications.setOfferStatus(other.id, OfferStatus.WITHDRAWN, null);
          this.applications.setStatus(other.application_id, ApplicationStatus.OFFER_WITHDRAWN);
        }
      }
      return accepted;
    });
  }

  decline(student, offerId) {
    const offer = this.#getPendingOffer(student, offerId);
    return this.db.transaction(() => {
      const declined = this.applications.setOfferStatus(offer.id, OfferStatus.DECLINED, utcnow());
      this.applications.setStatus(offer.application_id, ApplicationStatus.OFFER_DECLINED);
      return declined;
    });
  }

  #getPendingOffer(student, offerId) {
    const offer = this.applications.getOfferWithOwner(offerId);
    if (!offer) throw new NotFoundError('Offer not found');
    if (offer.student_id !== student.id) throw new ForbiddenError('This offer was not issued to you');
    if (offer.status !== OfferStatus.ISSUED) throw new BusinessRuleError(`This offer is already ${offer.status}`);
    return offer;
  }
}
