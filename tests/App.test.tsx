import { render, screen } from '@testing-library/react'
import App from '../src/App'

it('renders the SpellKick name', () => {
  render(<App />)
  expect(screen.getByText(/SpellKick/)).toBeInTheDocument()
})
