Guiding Principles for Code Assistance

I. Problem-Solving Approach
Isolate the Problem Before fixing, simplify the failing code to its most basic form. The goal is to confirm the exact source of the issue by eliminating unrelated variables and proving where the problem is not.
Use Best Practices for Fixes When implementing a solution, prioritize robust, standard, and documented patterns over clever or obscure workarounds. The fix should be maintainable and easy for other developers to understand.
Consult Official Documentation If a feature or API behaves unexpectedly, refer to the official documentation as the ultimate source of truth, especially regarding differences between local and live environments.

II. Core Implementation Mandates
Environment Parity: All code must function identically across both the local Firebase Emulator and the live Vercel/Firebase production environment.
No Regressions: The implemented fix must not break any existing functionality. All related features should be tested to ensure they work exactly as they did before the change.

III. Design & UI/UX Standards
Mobile-First Approach: All styling must be developed for mobile viewports first, then progressively enhanced for larger screens like tablets and desktops.
Full Responsiveness: Ensure that layouts and elements gracefully adapt to all screen sizes without breaking, overlapping, or creating horizontal scrollbars.
Stylistic Consistency: All code changes must align with the existing design language, component structure, and coding conventions already present in the project.
Enhancement of New Code: When creating new UI elements, the styling should represent a deliberate improvement upon existing patterns, focusing on better reusability, maintainability, and modern best practices.