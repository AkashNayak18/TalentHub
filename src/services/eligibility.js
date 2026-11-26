/**
 * Pure eligibility rules - no database access, easy to unit test.
 * A student is eligible when ALL of these hold:
 *   - CGPA >= job.min_cgpa                        (boundary value is eligible)
 *   - active backlogs <= job.max_active_backlogs  (boundary value is eligible)
 *   - branch is in job.allowed_branches, if the job restricts branches
 */
// Format numbers like the original (7 -> "7.0") so messages read the same.
const num = (n) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

export function checkEligibility(student, job) {
  const reasons = [];
  if (student.cgpa < job.min_cgpa) {
    reasons.push(`CGPA ${num(student.cgpa)} is below the required minimum of ${num(job.min_cgpa)}`);
  }
  if (student.active_backlogs > job.max_active_backlogs) {
    reasons.push(`${student.active_backlogs} active backlog(s) exceeds the allowed maximum of ${job.max_active_backlogs}`);
  }
  const allowed = job.allowed_branches;
  if (allowed.length && !allowed.includes(student.branch.trim().toUpperCase())) {
    reasons.push(`Branch ${student.branch} is not eligible (allowed: ${allowed.join(', ')})`);
  }
  return { eligible: reasons.length === 0, reasons };
}
