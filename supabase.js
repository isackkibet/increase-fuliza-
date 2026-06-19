// Supabase Configuration
const SUPABASE_URL = 'https://rxlnwmxtxousxyxdqkuw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4bG53bXh0eG91c3h5eGRxa3V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NzMxNjUsImV4cCI6MjA4OTQ0OTE2NX0.VBFQlEfvI7RsumwchQ3r5cqfsb0QF9LL1zsK2CVZab8';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Handle contact form submission
async function submitContactForm(event) {
  event.preventDefault();
  
  const form = event.target;
  const submitButton = form.querySelector('button[type="submit"]');
  const originalText = submitButton.textContent;
  
  // Get form values
  const formData = {
    name: form.name.value,
    email: form.email.value,
    phone: form.phone.value,
    message: form.message.value,
    created_at: new Date().toISOString()
  };
  
  try {
    // Disable button during submission
    submitButton.textContent = 'Sending...';
    submitButton.disabled = true;
    
    // Insert data into Supabase
    const { data, error } = await supabase
      .from('contacts')
      .insert([formData]);
    
    if (error) {
      throw error;
    }
    
    // Show success message
    alert('Thank you for your message! We will get back to you soon.');
    form.reset();
    
  } catch (error) {
    console.error('Error:', error);
    alert('Failed to send message. Please try again or contact us directly.');
  } finally {
    // Re-enable button
    submitButton.textContent = originalText;
    submitButton.disabled = false;
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  const contactForm = document.querySelector('.contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', submitContactForm);
  }
});
