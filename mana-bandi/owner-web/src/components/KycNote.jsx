/** Short explanation of the automated verification pipeline — provider kept abstract. */
export default function KycNote() {
  return (
    <div className="card note">
      <div className="card-body">
        <h3>How automatic verification works</h3>
        <p>
          The backend calls a KYC provider behind one interface (<code>IKycProvider</code>): Aadhaar is verified by OTP or DigiLocker consent (we never store the full number),
          the driving licence is looked up in the Sarathi registry (validity, class, name), the RC in the Vahan registry (owner name, validity, insurance), and the selfie is
          compared with the DL/Aadhaar photo by a face-match + liveness service. Every result becomes a chip here. A <b>fail</b> blocks approval, a <b>needs review</b>
          asks a human to decide; police verification is always manual. The captain still visits the town hub — the automation only shortens the 10-minute registration.
        </p>
      </div>
    </div>
  )
}
