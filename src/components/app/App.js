import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';
import CareGapsCheck from '../pages/CareGapsCheck/CareGapsCheck';

function App() {
  return (
    <Router>
      <Switch>
        <Route path='/' exact component={CareGapsCheck} />
        <Route exact path='/details' component={CareGapsCheck} />
      </Switch>
    </Router>
  );
}

export default App;
