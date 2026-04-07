import { Link } from 'react-router-dom';

function UnauthorizedPage() {
  return (
    <section>
      <div className="card">
        <h2>Access Restricted</h2>
        <p>This page is only available to admin users.</p>
        <Link className="button-link" to="/">
          Return to Dashboard
        </Link>
      </div>
    </section>
  );
}

export default UnauthorizedPage;
